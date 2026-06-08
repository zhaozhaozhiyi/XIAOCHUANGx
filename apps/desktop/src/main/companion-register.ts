/**
 * Desktop ↔ Companion 注册 / HMAC token 签发 — V1.1 D1.3
 * （desktop-v1.1-roadmap.md §5.2）
 *
 * 流程：
 *   1. 启动时读 ${app.getPath('userData')}/desktop-credentials.json
 *      - 命中：直接使用 clientId+secret，并发起 register（带 clientId）
 *        让 Companion 刷新 lastSeenAt（companion 侧幂等返回同 secret）
 *      - 未命中：不带 clientId 发 register，把响应的 clientId+secret 落盘
 *   2. ensureRegistered() 失败时返回 null —— 上层 import-folder 会降级到无
 *      token 走旧路径（仍可用，仅 fromTrustedPicker=false 的家目录限制）
 *   3. signImportToken({ baseDir }) 用本地 secret 签 HMAC-SHA256：
 *        token = `<clientId>.<nonceHex>.<expMs>.<sigHex>`
 *      与 companion/src/desktop/secrets.ts:verifyDesktopImportToken 对齐
 *
 * 失败策略：
 *   - register 网络失败 → 不阻塞用户操作，下次再试（10s 节流）
 *   - 凭证文件读写失败 → 仅记日志；in-memory 还能跑，重启后才丢
 */

import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { app } from "electron";

// -----------------------------------------------------------------------------
// 类型 / 常量
// -----------------------------------------------------------------------------

type Credentials = {
  version: 1;
  clientId: string;
  /** base64url(32B) */
  secret: string;
  /** Companion 侧记录的创建时间，仅供排错 */
  createdAt?: string;
  baseUrl: string;
  /** 本机 register 时填的 label（"小窗@hostname"） */
  label?: string;
};

const TOKEN_TTL_MS = 60_000; // 1min
const REGISTER_TIMEOUT_MS = 5_000;
const REGISTER_RETRY_COOLDOWN_MS = 10_000;

function credsPath(): string {
  return join(app.getPath("userData"), "desktop-credentials.json");
}

function defaultLabel(): string {
  return `小窗@${hostname()}`;
}

function companionBaseUrl(): string {
  return (process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477").replace(
    /\/$/,
    "",
  );
}

// -----------------------------------------------------------------------------
// 凭证持久化
// -----------------------------------------------------------------------------

async function loadCreds(): Promise<Credentials | null> {
  const path = credsPath();
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Credentials;
    if (
      parsed?.version !== 1 ||
      typeof parsed.clientId !== "string" ||
      typeof parsed.secret !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("[desktop] failed to read companion credentials:", err);
    return null;
  }
}

async function saveCreds(c: Credentials): Promise<void> {
  const path = credsPath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(c, null, 2), "utf8");
    if (process.platform !== "win32") {
      try {
        await chmod(path, 0o600);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn("[desktop] failed to write companion credentials:", err);
  }
}

// -----------------------------------------------------------------------------
// 注册器
// -----------------------------------------------------------------------------

class CompanionRegistrar {
  private creds: Credentials | null = null;
  /** 进行中的 register Promise，去重并发调用 */
  private inFlight: Promise<Credentials | null> | null = null;
  /** 上次 register 失败时间戳，用于节流 */
  private lastFailureAt = 0;

  /**
   * 启动期 / supervisor running 时调一次。失败不抛，仅返回 null。
   * 多次并发调用合并。
   */
  async ensureRegistered(): Promise<Credentials | null> {
    if (this.creds) {
      // 已有凭证：异步刷新一下 lastSeenAt（companion 侧幂等），不阻塞返回
      void this.refreshAsync();
      return this.creds;
    }

    if (this.inFlight) return this.inFlight;

    // 节流：上次失败 < 10s 内不重试，避免 Companion 还没跑起来时疯狂打
    if (
      this.lastFailureAt &&
      Date.now() - this.lastFailureAt < REGISTER_RETRY_COOLDOWN_MS
    ) {
      return null;
    }

    this.inFlight = (async () => {
      try {
        const fromDisk = await loadCreds();
        const result = await this.registerOnCompanion({
          clientId: fromDisk?.clientId,
          label: fromDisk?.label ?? defaultLabel(),
        });
        if (!result) {
          this.lastFailureAt = Date.now();
          return null;
        }
        // companion 幂等返回 secret；正常情况 secret 不变。
        // 若 fromDisk.secret 与返回不一致 → 以 companion 为准（fromDisk 损坏）
        const next: Credentials = {
          version: 1,
          clientId: result.clientId,
          secret: result.secret,
          createdAt: result.createdAt,
          baseUrl: companionBaseUrl(),
          label: fromDisk?.label ?? defaultLabel(),
        };
        await saveCreds(next);
        this.creds = next;
        this.lastFailureAt = 0;
        return next;
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  /** 已有 creds 时刷新 lastSeenAt；失败静默 */
  private async refreshAsync(): Promise<void> {
    if (!this.creds) return;
    try {
      await this.registerOnCompanion({
        clientId: this.creds.clientId,
        label: this.creds.label ?? defaultLabel(),
      });
    } catch {
      /* swallow */
    }
  }

  private async registerOnCompanion(input: {
    clientId?: string;
    label?: string;
  }): Promise<{ clientId: string; secret: string; createdAt?: string } | null> {
    try {
      const res = await fetch(`${companionBaseUrl()}/v1/desktop/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          `[desktop] companion register failed status=${res.status} body=${text.slice(
            0,
            200,
          )}`,
        );
        return null;
      }
      const body = (await res.json()) as {
        clientId?: string;
        secret?: string;
        createdAt?: string;
      };
      if (!body.clientId || !body.secret) {
        console.warn("[desktop] companion register: malformed response", body);
        return null;
      }
      return {
        clientId: body.clientId,
        secret: body.secret,
        createdAt: body.createdAt,
      };
    } catch (err) {
      console.warn("[desktop] companion register error:", err);
      return null;
    }
  }

  /**
   * 用当前凭证给 baseDir 签一个 token；无凭证时尝试现场 register。
   * register 仍失败 → 返回 null，调用方走无 token 路径（向下兼容）。
   */
  async signImportToken(input: {
    baseDir: string;
  }): Promise<string | null> {
    const creds = this.creds ?? (await this.ensureRegistered());
    if (!creds) return null;
    const nonce = randomBytes(16).toString("hex");
    const exp = Date.now() + TOKEN_TTL_MS;
    const sig = createHmac("sha256", Buffer.from(creds.secret, "base64url"))
      .update(`${input.baseDir}|${nonce}|${exp}`)
      .digest("hex");
    return `${creds.clientId}.${nonce}.${exp}.${sig}`;
  }

  /** 排错用：当前凭证摘要（不暴露 secret） */
  getSummary(): { clientId?: string; baseUrl?: string; hasSecret: boolean } {
    return {
      clientId: this.creds?.clientId,
      baseUrl: this.creds?.baseUrl,
      hasSecret: !!this.creds,
    };
  }
}

// -----------------------------------------------------------------------------
// 模块级单例
// -----------------------------------------------------------------------------

let _instance: CompanionRegistrar | null = null;

export function getCompanionRegistrar(): CompanionRegistrar {
  if (!_instance) _instance = new CompanionRegistrar();
  return _instance;
}
