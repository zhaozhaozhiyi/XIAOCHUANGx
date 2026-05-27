"use client";

import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import {
  VOICE_CAPABILITY_LABELS,
  VOICE_CAPABILITY_ORDER,
  VOICE_MODEL_PRESETS,
  createVoiceModelEntryId,
  groupVoiceModelsByType,
  hasUsableVoiceProvider,
  providerVoiceCapabilityTypes,
  voiceVendorById,
  type VoiceModelEntry,
  type VoiceProviderInstance,
} from "@/lib/voice/voice-providers";
import { VoiceTypeBadge } from "./VoiceTypeBadge";

type Notice = { kind: "success" | "error"; text: string };

type VoiceProviderCardProps = {
  provider: VoiceProviderInstance;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (next: VoiceProviderInstance) => void;
  onRemove: () => void;
};

function vendorInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function ModelRow({
  model,
  onChange,
  onRemove,
}: {
  model: VoiceModelEntry;
  onChange: (next: VoiceModelEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="model-provider-model-item">
      <label className="model-provider-model-item__main">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[var(--accent)]"
          checked={model.enabled}
          onChange={(e) => onChange({ ...model, enabled: e.target.checked })}
        />
        <span className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <input
              className="model-provider-model-item__label min-w-0 flex-1 border-none bg-transparent p-0 outline-none"
              value={model.label}
              placeholder="显示名称"
              onChange={(e) => onChange({ ...model, label: e.target.value })}
            />
            <VoiceTypeBadge type={model.type} />
          </div>
          <input
            className="model-provider-model-item__id w-full border-none bg-transparent p-0 outline-none"
            value={model.modelId}
            placeholder="model-id"
            onChange={(e) => onChange({ ...model, modelId: e.target.value })}
          />
          {model.type === "tts" && (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-[var(--border)] bg-white px-2 py-1 font-mono text-[10px]"
                value={model.voiceId ?? ""}
                placeholder="voice-id（可选）"
                onChange={(e) =>
                  onChange({ ...model, voiceId: e.target.value })
                }
              />
              <input
                className="w-20 rounded border border-[var(--border)] bg-white px-2 py-1 text-[10px]"
                value={model.language ?? ""}
                placeholder="zh-CN"
                onChange={(e) =>
                  onChange({ ...model, language: e.target.value })
                }
              />
            </div>
          )}
        </span>
      </label>
      <button
        type="button"
        className="model-provider-icon-btn"
        aria-label="删除模型"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function VoiceProviderCard({
  provider,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
}: VoiceProviderCardProps) {
  const vendor = voiceVendorById(provider.vendorId);
  const accent = vendor?.accent ?? "#87867f";
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const ready = hasUsableVoiceProvider(provider);
  const capabilityTypes = providerVoiceCapabilityTypes(provider);
  const grouped = groupVoiceModelsByType(provider.models);
  const enabledModelCount = provider.models.filter((m) => m.enabled).length;
  const displayName =
    provider.displayName || vendor?.name || "未命名 Provider";

  const patch = (partial: Partial<VoiceProviderInstance>) =>
    onChange({ ...provider, ...partial });

  const patchModels = (models: VoiceModelEntry[]) => patch({ models });

  const updateModel = (id: string, next: VoiceModelEntry) => {
    patchModels(provider.models.map((m) => (m.id === id ? next : m)));
  };

  const removeModel = (id: string) => {
    patchModels(provider.models.filter((m) => m.id !== id));
  };

  const addModel = (type: VoiceModelEntry["type"]) => {
    patchModels([
      ...provider.models,
      {
        id: createVoiceModelEntryId(),
        modelId: "",
        label: "",
        type,
        enabled: true,
      },
    ]);
  };

  const applyPresets = () => {
    const presets = VOICE_MODEL_PRESETS[provider.vendorId];
    if (!presets) return;

    const existingIds = new Set(
      provider.models.map((m) => m.modelId.trim().toLowerCase()),
    );
    const merged = [...provider.models];

    for (const type of VOICE_CAPABILITY_ORDER) {
      const items = presets[type];
      if (!items) continue;
      for (const item of items) {
        const modelId = item.modelId.trim();
        if (!modelId || existingIds.has(modelId.toLowerCase())) continue;
        existingIds.add(modelId.toLowerCase());
        merged.push({
          id: createVoiceModelEntryId(),
          modelId,
          label: item.label,
          type,
          enabled: true,
          language: type === "tts" ? "zh-CN" : undefined,
        });
      }
    }

    patchModels(merged);
    setNotice({ kind: "success", text: "已填入该厂商推荐模型" });
  };

  const testConnection = async () => {
    setTesting(true);
    setNotice(null);
    try {
      await new Promise((r) => setTimeout(r, 600));
      if (!provider.apiKey.trim() && !provider.baseUrl.includes("localhost")) {
        setNotice({ kind: "error", text: "请先填写 API Key" });
        return;
      }
      setNotice({ kind: "success", text: "连接测试通过（原型 Mock）" });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "连接测试失败",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <article
      className={`model-provider-card ${expanded ? "model-provider-card--expanded" : ""} ${provider.enabled ? "" : "opacity-70"}`}
      style={{ ["--vendor-accent" as string]: accent }}
    >
      <header className="model-provider-card__header">
        <button
          type="button"
          className="model-provider-card__expand"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "收起" : "展开"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        <span
          className="model-vendor-avatar"
          style={{ ["--vendor-accent" as string]: accent }}
        >
          {vendorInitial(displayName)}
        </span>

        <button
          type="button"
          className="model-provider-card__meta min-w-0 text-left"
          onClick={onToggleExpand}
        >
          <span className="model-provider-card__title-row">
            <span className="model-provider-card__title">{displayName}</span>
            <span
              className={`model-provider-status ${
                ready ? "model-provider-status--ok" : "model-provider-status--idle"
              }`}
            >
              {ready ? "凭证就绪" : "待配置"}
            </span>
          </span>
          {vendor && provider.displayName !== vendor.name && (
            <p className="model-provider-card__subtitle">{vendor.name}</p>
          )}
          <span className="model-provider-card__badges">
            {capabilityTypes.map((type) => (
              <VoiceTypeBadge key={type} type={type} />
            ))}
            <span className="text-[10px] text-[var(--fg-tertiary)]">
              {enabledModelCount} 个模型已启用
            </span>
          </span>
        </button>

        <div className="model-provider-card__actions">
          <label className="flex items-center gap-1.5 text-xs text-[var(--fg-secondary)]">
            <span>启用</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={provider.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
          </label>
          <button
            type="button"
            className="model-provider-icon-btn"
            aria-label="删除 Provider"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="model-provider-card__body">
          <div className="model-provider-form">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-overline">显示名称</span>
                <input
                  className="model-provider-input"
                  value={provider.displayName}
                  onChange={(e) => patch({ displayName: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-overline">厂商</span>
                <input
                  className="model-provider-input bg-[var(--surface)] text-[var(--fg-secondary)]"
                  value={vendor?.name ?? provider.vendorId}
                  readOnly
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-overline">Base URL</span>
              <input
                className="model-provider-input"
                value={provider.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
                placeholder={vendor?.defaultBaseUrl}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-overline">API Key</span>
                <input
                  type="password"
                  className="model-provider-input"
                  value={provider.apiKey}
                  onChange={(e) => patch({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </label>
              <label className="space-y-1">
                <span className="text-overline">App Secret / Token</span>
                <input
                  type="password"
                  className="model-provider-input"
                  value={provider.appSecret}
                  onChange={(e) => patch({ appSecret: e.target.value })}
                  placeholder="部分云厂商需要"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 text-sm"
                onClick={() => void testConnection()}
                disabled={testing}
              >
                <Wand2 className="h-4 w-4" strokeWidth={1.75} />
                {testing ? "测试中…" : "测试连接"}
              </button>
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 text-sm"
                onClick={applyPresets}
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                填入推荐模型
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

            <div className="model-provider-model-groups">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--fg)]">语音模型</p>
                <div className="flex flex-wrap gap-1">
                  {VOICE_CAPABILITY_ORDER.filter((type) =>
                    vendor?.supportedTypes.includes(type),
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="model-provider-add-model-btn border-none bg-transparent p-0"
                      onClick={() => addModel(type)}
                    >
                      + {VOICE_CAPABILITY_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {provider.models.length === 0 ? (
                <p className="model-provider-empty-hint rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center">
                  尚未配置语音模型。可点击「填入推荐模型」或手动添加。
                </p>
              ) : (
                VOICE_CAPABILITY_ORDER.map((type) => {
                  const models = grouped[type];
                  if (!models.length) return null;
                  return (
                    <div key={type}>
                      <p className="model-provider-model-group__title">
                        {VOICE_CAPABILITY_LABELS[type]}
                      </p>
                      <div className="model-provider-model-list">
                        {models.map((model) => (
                          <ModelRow
                            key={model.id}
                            model={model}
                            onChange={(next) => updateModel(model.id, next)}
                            onRemove={() => removeModel(model.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
