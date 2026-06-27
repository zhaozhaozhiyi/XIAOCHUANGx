"use client";

import { Copy, Download, HelpCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";

// V1.1 D1.5：自动更新（desktop-v1.1-roadmap.md §7）
// preload contextBridge 暴露的 electronAPI.updater 形状；与
// apps/desktop/src/preload/preload.cjs / src/main/auto-updater.ts 对齐
type UpdaterState =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "not-available"
  | "error";

type UpdaterStatus = {
  state: UpdaterState;
  currentVersion: string;
  nextVersion?: string;
  progressPercent?: number;
  error?: string;
  lastCheckedAt?: number;
  hint?: string;
};

type UpdaterApi = {
  getStatus: () => Promise<UpdaterStatus>;
  check: () => Promise<UpdaterStatus>;
  installNow: () => Promise<{ ok: boolean }>;
  onStatusChange: (cb: (s: UpdaterStatus) => void) => () => void;
};

function readUpdaterApi(): UpdaterApi | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    electronAPI?: { updater?: UpdaterApi };
  };
  return w.electronAPI?.updater ?? null;
}

export function AboutSettingsSection() {
  const { settings, updateSettings, agentsRuntime } = useSettings();
  const [copied, setCopied] = useState(false);
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // 订阅 updater 状态；非桌面壳（如浏览器演示版）下 updater 为 null，整个块降级
  useEffect(() => {
    const api = readUpdaterApi();
    if (!api) return;
    let mounted = true;
    void api.getStatus().then((s) => {
      if (mounted) setUpdater(s);
    });
    const unsub = api.onStatusChange((s) => {
      if (mounted) setUpdater(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const onCheckUpdate = async () => {
    const api = readUpdaterApi();
    if (!api) return;
    setChecking(true);
    try {
      await api.check();
    } finally {
      setChecking(false);
    }
  };

  const onInstallNow = async () => {
    const api = readUpdaterApi();
    if (!api) return;
    await api.installNow();
  };

  const desktopVersion = updater?.currentVersion ?? "0.1.0-prototype";

  const copyDiagnostics = async () => {
    const payload = {
      platform: `小窗 ${desktopVersion}`,
      dataSources: "mock 26.1",
      agents: agentsRuntime.agents,
      inferenceChannel: agentsRuntime.inferenceChannel,
      companionOk: agentsRuntime.companionOk,
      defaultAgent: settings.defaultAgentId,
      updater: updater
        ? {
            state: updater.state,
            nextVersion: updater.nextVersion,
            lastCheckedAt: updater.lastCheckedAt,
          }
        : null,
      ts: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        <p className="text-overline">版本</p>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">小窗</dt>
            <dd className="font-mono text-[var(--fg)]">{desktopVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">数据源</dt>
            <dd className="font-mono text-[var(--fg)]">26.1.0</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">智能体组件包</dt>
            <dd className="font-mono text-[var(--fg)]">cli-bundle-2026.05</dd>
          </div>
        </dl>
      </div>

      {updater ? (
        <UpdaterPanel
          status={updater}
          checking={checking}
          onCheck={onCheckUpdate}
          onInstall={onInstallNow}
        />
      ) : null}

      <button
        type="button"
        className="btn btn-secondary w-full justify-center gap-2 py-2 text-sm"
        onClick={() => void copyDiagnostics()}
      >
        <Copy className="h-4 w-4" strokeWidth={1.75} />
        {copied ? "已复制诊断信息" : "复制诊断信息"}
      </button>

      <a
        href="#"
        className="btn btn-secondary flex w-full items-center justify-center gap-2 py-2 text-sm"
        onClick={(e) => {
          e.preventDefault();
          window.alert("原型：打开帮助文档");
        }}
      >
        <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
        使用帮助与反馈
      </a>

      <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="text-[var(--fg-secondary)]">模拟管理员视图（原型）</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={settings.simulateAdmin}
            onChange={(e) => updateSettings({ simulateAdmin: e.target.checked })}
          />
        </label>
        <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
          开启后在用户菜单中显示 BYOK、功能与审计占位项
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UpdaterPanel — V1.1 D1.5
// ---------------------------------------------------------------------------

function UpdaterPanel({
  status,
  checking,
  onCheck,
  onInstall,
}: {
  status: UpdaterStatus;
  checking: boolean;
  onCheck: () => void;
  onInstall: () => void;
}) {
  const { state, nextVersion, progressPercent, hint, lastCheckedAt, error } =
    status;

  // dev 模式（state === 'disabled'）只显示提示，不显示按钮；
  // 避免用户在 pnpm dev 里点"检查更新"得到一脸 dev-app-update.yml 报错
  const isDisabled = state === "disabled";
  const showInstall = state === "downloaded";
  const showProgress = state === "downloading" && progressPercent != null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-overline">自动更新</p>
          <p className="mt-1 text-sm text-[var(--fg)]">
            {hint ?? "已是最新版本"}
          </p>
          {nextVersion && state !== "not-available" ? (
            <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
              新版本 · v{nextVersion}
            </p>
          ) : null}
          {error ? (
            <p className="mt-1 text-xs text-[var(--danger,#c33)]">{error}</p>
          ) : null}
          {lastCheckedAt ? (
            <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
              上次检查 · {new Date(lastCheckedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      {showProgress ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded bg-[var(--surface-sunken,#eee)]">
          <div
            className="h-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      ) : null}

      {!isDisabled ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary justify-center gap-2 py-2 text-sm"
            onClick={onCheck}
            disabled={checking || state === "checking" || state === "downloading"}
          >
            <RefreshCw
              className={`h-4 w-4 ${checking || state === "checking" ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            {state === "checking" ? "检查中…" : "检查更新"}
          </button>
          {showInstall ? (
            <button
              type="button"
              className="btn btn-primary justify-center gap-2 py-2 text-sm"
              onClick={onInstall}
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              立即重启更新
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          开发模式下自动更新已禁用
        </p>
      )}
    </div>
  );
}
