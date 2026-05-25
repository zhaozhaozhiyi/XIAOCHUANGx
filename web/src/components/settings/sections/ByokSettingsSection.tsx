"use client";

import { RefreshCw, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import {
  DEFAULT_API_PROVIDER_CONFIG,
  hasUsableApiProviderConfig,
  providerDisplayName,
  trimApiProviderConfig,
  type ApiProviderConfig,
} from "@/lib/byok/shared";

type Notice = {
  kind: "success" | "error";
  text: string;
};

export function ByokSettingsSection() {
  const { settings, updateSettings } = useSettings();
  const [draft, setDraft] = useState<ApiProviderConfig>(settings.apiProvider);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const normalized = useMemo(() => trimApiProviderConfig(draft), [draft]);
  const ready = hasUsableApiProviderConfig(normalized);

  useEffect(() => {
    setDraft(settings.apiProvider);
  }, [settings.apiProvider]);

  const saveDraft = () => {
    updateSettings({ apiProvider: normalized });
    setNotice({ kind: "success", text: "已保存模型 API 配置" });
    window.setTimeout(() => setNotice(null), 3000);
  };

  const testConnection = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/byok/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        provider?: string;
        models?: Array<{ id: string }>;
      };
      if (!payload.ok) {
        setNotice({
          kind: "error",
          text: payload.error ?? "连接测试失败",
        });
        return;
      }
      setNotice({
        kind: "success",
        text: `连接成功：${payload.provider ?? providerDisplayName(normalized)}${payload.models?.length ? ` · ${payload.models.length} 个模型` : ""}`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "连接测试失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setNotice(null);
    try {
      const res = await fetch("/api/byok/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        models?: Array<{ id: string; label: string }>;
      };
      if (!payload.ok || !payload.models?.length) {
        setNotice({
          kind: "error",
          text: payload.error ?? "未获取到可用模型",
        });
        return;
      }
      const preferred =
        payload.models.find((model) => model.id === normalized.model)?.id ??
        payload.models[0]?.id ??
        normalized.model;
      setDraft((prev) => ({ ...prev, model: preferred }));
      setNotice({
        kind: "success",
        text: `已获取 ${payload.models.length} 个模型，默认选中 ${preferred}`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "模型拉取失败",
      });
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--fg-secondary)]">
        配置 OpenAI 兼容或 Anthropic 协议接入。保存后，在对话顶栏选择「模型 API」作为执行通道。
      </p>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm">
        <span>
          <span className="block font-medium text-[var(--fg)]">启用模型 API</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)]">
            开启后可在对话顶栏选用该 Provider；当前会话用哪条通道在对话区切换
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={draft.enabled}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, enabled: e.target.checked }))
          }
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-overline">协议</span>
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={draft.protocol}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                protocol:
                  e.target.value === "anthropic" ? "anthropic" : "openai",
              }))
            }
          >
            <option value="openai">OpenAI Compatible</option>
            <option value="anthropic">Anthropic Messages API</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-overline">显示名称</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={draft.providerLabel}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, providerLabel: e.target.value }))
            }
            placeholder="例如 OpenAI / OpenRouter / 企业网关"
          />
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-overline">Base URL</span>
        <input
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={draft.baseUrl}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))
          }
          placeholder="https://api.openai.com/v1"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-overline">API Key</span>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={draft.apiKey}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, apiKey: e.target.value }))
            }
            placeholder="sk-..."
          />
        </label>

        <label className="space-y-1">
          <span className="text-overline">模型 ID</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={draft.model}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, model: e.target.value }))
            }
            placeholder="gpt-4.1 / claude-sonnet-4-20250514"
          />
        </label>
      </div>

      {draft.protocol === "anthropic" && (
        <label className="space-y-1">
          <span className="text-overline">Anthropic Version</span>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            value={draft.anthropicVersion}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                anthropicVersion: e.target.value,
              }))
            }
            placeholder="2023-06-01"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-sm"
          onClick={() => void testConnection()}
          disabled={!ready || testing}
        >
          <Wand2 className="h-4 w-4" strokeWidth={1.75} />
          {testing ? "测试中…" : "测试连接"}
        </button>
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-sm"
          onClick={() => void loadModels()}
          disabled={!ready || loadingModels}
        >
          <RefreshCw
            className={`h-4 w-4 ${loadingModels ? "animate-spin" : ""}`}
            strokeWidth={1.75}
          />
          拉取模型
        </button>
        <button
          type="button"
          className="btn px-3 py-2 text-sm"
          onClick={saveDraft}
        >
          保存配置
        </button>
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-sm"
          onClick={() => setDraft(DEFAULT_API_PROVIDER_CONFIG)}
        >
          重置
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.kind === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs leading-6 text-[var(--fg-tertiary)]">
        当前 Provider 名称：
        <span className="font-medium text-[var(--fg)]">
          {providerDisplayName(normalized)}
        </span>
        。MVP 先支持 OpenAI 兼容与 Anthropic 两种协议，后续可继续扩展更多 Provider，
        但仍保持同一条对话编排与事件流架构。
      </div>
    </div>
  );
}
