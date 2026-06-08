/**
 * Desktop secrets store — V1.1 D1.3（desktop-v1.1-roadmap.md §5）
 *
 * 持久化文件：${COMPANION_DATA_DIR}/desktop-secrets.json
 *   {
 *     "version": 1,
 *     "clients": [
 *       { "clientId": "<random>", "secret": "<base64url>", "createdAt": "<iso>",
 *         "label"?: "...", "lastSeenAt"?: "<iso>" }
 *     ]
 *   }
 *
 * 设计取舍：
 *  - 一台桌面壳实例对应一个 clientId/secret 对。clientId 由桌面壳侧生成
 *    （UUID）随首次 register 上报，Companion 用它当 key 找 secret。
 *  - clientId 已存在 → 返回已有 secret（**幂等**）。这样桌面壳重启 / 升级不必
 *    再重 register，丢 secret 才走 register。
 *  - secret 是 32 字节随机；HMAC-SHA256 用它签 token。
 *  - 文件权限：尽力 0600（POSIX）；Win 的 ACL 用默认（落在 %USERPROFILE% 下，
 *    其它用户无读权限）。
 *  - 没做"撤销列表"：未来要 revoke 直接删条目即可（v1.1 不做 UI）。
 */

import {
  access,
  chmod,
  constants,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// -----------------------------------------------------------------------------
// 类型
// -----------------------------------------------------------------------------

export type DesktopClient = {
  clientId: string;
  /** base64url(32B) — 用于 HMAC-SHA256 */
  secret: string;
  createdAt: string;
  /** 可选的人类标签（"desktop@hostname"） */
  label?: string;
  /** 上次成功 register 的时间（每次 register 刷新；轮询不刷新） */
  lastSeenAt?: string;
};

type SecretsDb = {
  version: 1;
  clients: DesktopClient[];
};

// -----------------------------------------------------------------------------
// 文件 IO
// -----------------------------------------------------------------------------

function dbPath(): string {
  return join(config.dataDir, "desktop-secrets.json");
}

async function ensureDir(): Promise<void> {
  await mkdir(dirname(dbPath()), { recursive: true });
}

async function loadDb(): Promise<SecretsDb> {
  await ensureDir();
  try {
    const raw = await readFile(dbPath(), "utf8");
    const parsed = JSON.parse(raw) as SecretsDb;
    if (parsed?.version !== 1 || !Array.isArray(parsed.clients)) {
      return { version: 1, clients: [] };
    }
    return parsed;
  } catch {
    return { version: 1, clients: [] };
  }
}

async function saveDb(db: SecretsDb): Promise<void> {
  await ensureDir();
  const json = JSON.stringify(db, null, 2);
  await writeFile(dbPath(), json, "utf8");
  // POSIX：尽力把权限改成 0600；失败（Win/部分 FS）静默
  if (process.platform !== "win32") {
    try {
      await chmod(dbPath(), 0o600);
    } catch {
      /* ignore */
    }
  }
}

// -----------------------------------------------------------------------------
// 公有 API
// -----------------------------------------------------------------------------

function generateSecret(): string {
  // base64url 不含 padding；32B 原始 → 43 字符
  return randomBytes(32).toString("base64url");
}

function generateClientId(): string {
  return `dc-${randomUUID().slice(0, 8)}${randomUUID().slice(0, 4)}`;
}

/**
 * 注册（或返回已有）一个桌面客户端的 secret。
 *
 * - 传入的 clientId 已存在 → 返回已有 secret（幂等），刷新 lastSeenAt/label
 * - 传入的 clientId 不存在 / 未传 → 新建条目并下发新 secret
 *
 * 返回 { clientId, secret }；secret 仅在此一次性返回，桌面壳必须自行持久化。
 */
export async function registerDesktopClient(input: {
  clientId?: string;
  label?: string;
}): Promise<{ clientId: string; secret: string; createdAt: string }> {
  const db = await loadDb();
  const now = new Date().toISOString();

  if (input.clientId) {
    const existing = db.clients.find((c) => c.clientId === input.clientId);
    if (existing) {
      existing.lastSeenAt = now;
      if (input.label && existing.label !== input.label) {
        existing.label = input.label;
      }
      await saveDb(db);
      return {
        clientId: existing.clientId,
        secret: existing.secret,
        createdAt: existing.createdAt,
      };
    }
  }

  const clientId = input.clientId?.trim() || generateClientId();
  const secret = generateSecret();
  const record: DesktopClient = {
    clientId,
    secret,
    createdAt: now,
    label: input.label,
    lastSeenAt: now,
  };
  db.clients.push(record);
  await saveDb(db);
  return { clientId, secret, createdAt: now };
}

/**
 * 单纯按 clientId 查 secret（HMAC 校验时用）。
 * 不刷新 lastSeenAt 以避免每次 import-folder 都写盘。
 */
export async function findClientSecret(
  clientId: string,
): Promise<string | null> {
  if (!clientId) return null;
  const db = await loadDb();
  const c = db.clients.find((x) => x.clientId === clientId);
  return c?.secret ?? null;
}

/** 为方便调试用：返回 secrets 文件路径（已做兜底，文件可能尚未存在） */
export function desktopSecretsPath(): string {
  return dbPath();
}

/** 仅供测试 / 排错：判断文件是否存在 */
export async function desktopSecretsFileExists(): Promise<boolean> {
  try {
    await access(dbPath(), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// HMAC token 校验（路由层共用）
// -----------------------------------------------------------------------------

/**
 * Token 格式：`<clientId>.<nonceHex>.<expMs>.<sigHex>`
 *
 *   sig = HMAC-SHA256(secret, `${baseDir}|${nonce}|${exp}`)
 *
 * - nonce：随机 16B hex（桌面侧每次请求生成）
 * - exp：毫秒时间戳，桌面壳生成时 = Date.now() + 60_000（1min 有效）
 * - 校验：clientId 找 secret → 重算 sig 比对 → exp 未过期
 *
 * 注：未做 nonce 重放表（V1.1 极简）。短 ttl + loopback-only + 主进程持有
 * secret 可以接受；后续若有担忧可加 LRU。
 */

export type TokenVerification =
  | { ok: true; clientId: string }
  | {
      ok: false;
      code:
        | "missing"
        | "malformed"
        | "unknown_client"
        | "bad_signature"
        | "expired";
    };

const TOKEN_RE = /^([\w-]+)\.([0-9a-f]+)\.(\d+)\.([0-9a-f]+)$/i;

export async function verifyDesktopImportToken(input: {
  /** Header 原值；可能 undefined */
  token: string | undefined;
  /** 与签名时一致的 baseDir（路由 body 里的） */
  baseDir: string;
  /** 当前时间（ms），允许测试注入；默认 Date.now() */
  now?: number;
}): Promise<TokenVerification> {
  const raw = (input.token ?? "").trim();
  if (!raw) return { ok: false, code: "missing" };

  const m = TOKEN_RE.exec(raw);
  if (!m) return { ok: false, code: "malformed" };
  const clientId = m[1]!;
  const nonce = m[2]!;
  const exp = Number(m[3]!);
  const sigHex = m[4]!;
  if (!Number.isFinite(exp)) return { ok: false, code: "malformed" };

  const now = input.now ?? Date.now();
  if (now > exp) return { ok: false, code: "expired" };

  const secret = await findClientSecret(clientId);
  if (!secret) return { ok: false, code: "unknown_client" };

  const expected = createHmac("sha256", Buffer.from(secret, "base64url"))
    .update(`${input.baseDir}|${nonce}|${exp}`)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sigHex, "hex");
  } catch {
    return { ok: false, code: "malformed" };
  }
  if (provided.length !== expected.length) {
    return { ok: false, code: "bad_signature" };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, code: "bad_signature" };
  }
  return { ok: true, clientId };
}
