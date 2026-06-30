"use client";

import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  MODEL_CAPABILITY_LABELS,
  MODEL_CAPABILITY_ORDER,
  createModelEntryId,
  groupModelsByType,
  hasConnectableProviderInstance,
  hasUsableProviderInstance,
  inferModelType,
  providerCapabilityTypes,
  providerCredentialSchema,
  providerToApiConfig,
  vendorById,
  type ModelEntry,
  type ModelProviderInstance,
} from "@/lib/byok/model-providers";
import {
  redactSensitiveText,
  toUserFacingProviderError,
} from "@/lib/byok/shared";
import { CredentialForm } from "./CredentialForm";
import { ModelProviderIcon } from "./ModelProviderIcon";
import { ModelTypeBadge } from "./ModelTypeBadge";

type Notice = { kind: "success" | "error"; text: string };

type ModelProviderCardProps = {
  provider: ModelProviderInstance;
  expanded: boolean;
  /** 草稿态：未通过连接测试前不落盘 */
  isDraft?: boolean;
  onToggleExpand: () => void;
  onChange: (next: ModelProviderInstance) => void;
  onRemove: () => void;
  onConnectionVerified?: (provider: ModelProviderInstance) => void;
};

function ModelRow({
  model,
  onChange,
  onRemove,
}: {
  model: ModelEntry;
  onChange: (next: ModelEntry) => void;
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
        <span className="min-w-0 flex-1">
          <input
            className="model-provider-model-item__label w-full border-none bg-transparent p-0 outline-none"
            value={model.label}
            placeholder="显示名称"
            onChange={(e) => onChange({ ...model, label: e.target.value })}
          />
          <input
            className="model-provider-model-item__id w-full border-none bg-transparent p-0 outline-none"
            value={model.modelId}
            placeholder="model-id"
            onChange={(e) => onChange({ ...model, modelId: e.target.value })}
          />
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

export function ModelProviderCard({
  provider,
  expanded,
  isDraft = false,
  onToggleExpand,
  onChange,
  onRemove,
  onConnectionVerified,
}: ModelProviderCardProps) {
  const vendor = vendorById(provider.vendorId);
  const accent = vendor?.accent ?? "#87867f";
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const toSafeNotice = (message: string, fallback: string) =>
    toUserFacingProviderError({
      detail: redactSensitiveText(message),
      fallback,
    });

  const apiConfig = useMemo(
    () => providerToApiConfig(provider),
    [provider],
  );

  const credentialSchema = useMemo(
    () => providerCredentialSchema(provider),
    [provider],
  );

  const connectable = hasConnectableProviderInstance(provider);
  const ready = hasUsableProviderInstance(provider);

  const capabilityTypes = providerCapabilityTypes(provider);
  const grouped = groupModelsByType(provider.models);
  const enabledModelCount = provider.models.filter((m) => m.enabled).length;
  const displayName =
    provider.displayName || vendor?.name || "未命名 Provider";

  const patch = (partial: Partial<ModelProviderInstance>) =>
    onChange({ ...provider, ...partial });

  const patchModels = (models: ModelEntry[]) => patch({ models });

  const updateModel = (id: string, next: ModelEntry) => {
    patchModels(provider.models.map((m) => (m.id === id ? next : m)));
  };

  const removeModel = (id: string) => {
    patchModels(provider.models.filter((m) => m.id !== id));
  };

  const addModel = (type: ModelEntry["type"]) => {
    patchModels([
      ...provider.models,
      {
        id: createModelEntryId(),
        modelId: "",
        label: "",
        type,
        enabled: true,
      },
    ]);
  };

  const testConnection = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/byok/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiConfig),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        models?: Array<{ id: string }>;
      };
      if (!payload.ok) {
        setNotice({
          kind: "error",
          text: toSafeNotice(
            payload.error ?? "连接测试失败",
            "连接测试失败，请检查 Provider 地址与 API Key 配置。",
          ),
        });
        return;
      }
      setNotice({
        kind: "success",
        text: `连接成功${payload.models?.length ? ` · ${payload.models.length} 个模型可用` : ""}`,
      });
      const nextProvider = { ...provider, connectionVerified: true };
      onChange(nextProvider);
      onConnectionVerified?.(nextProvider);
    } catch (error) {
      setNotice({
        kind: "error",
        text: toSafeNotice(
          error instanceof Error ? error.message : "连接测试失败",
          "连接测试失败，请检查 Provider 地址与 API Key 配置。",
        ),
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
        body: JSON.stringify(apiConfig),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        models?: Array<{ id: string; label: string }>;
      };
      if (!payload.ok || !payload.models?.length) {
        setNotice({
          kind: "error",
          text: toSafeNotice(
            payload.error ?? "未获取到可用模型",
            "模型拉取失败，请检查 Provider 地址、API Key 与模型权限。",
          ),
        });
        return;
      }

      const existingIds = new Set(
        provider.models.map((m) => m.modelId.trim().toLowerCase()),
      );
      const merged = [...provider.models];
      let added = 0;

      for (const remote of payload.models) {
        const modelId = remote.id.trim();
        if (!modelId || existingIds.has(modelId.toLowerCase())) continue;
        existingIds.add(modelId.toLowerCase());
        merged.push({
          id: createModelEntryId(),
          modelId,
          label: remote.label.trim() || modelId,
          type: inferModelType(modelId),
          enabled: true,
        });
        added += 1;
      }

      patchModels(merged);
      setNotice({
        kind: "success",
        text:
          added > 0
            ? `已拉取 ${payload.models.length} 个模型，新增 ${added} 个`
            : `已拉取 ${payload.models.length} 个模型（均已存在）`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: toSafeNotice(
          error instanceof Error ? error.message : "模型拉取失败",
          "模型拉取失败，请检查 Provider 地址、API Key 与模型权限。",
        ),
      });
    } finally {
      setLoadingModels(false);
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
          className="model-vendor-avatar model-vendor-avatar--logo"
          style={{ ["--vendor-accent" as string]: accent }}
        >
          <ModelProviderIcon vendorId={provider.vendorId} size={20} />
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
                ready
                  ? "model-provider-status--ok"
                  : connectable
                    ? "model-provider-status--idle"
                    : "model-provider-status--error"
              }`}
            >
              {ready ? "可用" : connectable ? "凭证就绪" : "待配置"}
            </span>
          </span>
          {vendor && provider.displayName !== vendor.name && (
            <p className="model-provider-card__subtitle">{vendor.name}</p>
          )}
          <span className="model-provider-card__badges">
            {capabilityTypes.map((type) => (
              <ModelTypeBadge key={type} type={type} />
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
            aria-label={isDraft ? "取消配置" : "删除 Provider"}
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
                <span className="text-overline">协议</span>
                <input
                  className="model-provider-input bg-[var(--surface)] text-[var(--fg-secondary)]"
                  value={
                    provider.protocol === "anthropic"
                      ? "Anthropic Messages API"
                      : "OpenAI Compatible"
                  }
                  readOnly
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-overline">协议</span>
              <input
                className="model-provider-input bg-[var(--surface)] text-[var(--fg-secondary)]"
                value={
                  provider.protocol === "anthropic"
                    ? "Anthropic Messages API"
                    : "OpenAI Compatible"
                }
                readOnly
              />
            </label>

            <CredentialForm
              schema={credentialSchema}
              values={provider.credentials}
              onChange={(credentials) => patch({ credentials })}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 text-sm"
                onClick={() => void testConnection()}
                disabled={!connectable || testing}
              >
                <Wand2 className="h-4 w-4" strokeWidth={1.75} />
                {testing ? "测试中…" : "测试连接"}
              </button>
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 text-sm"
                onClick={() => void loadModels()}
                disabled={!connectable || loadingModels}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingModels ? "animate-spin" : ""}`}
                  strokeWidth={1.75}
                />
                拉取模型
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
                <p className="text-sm font-medium text-[var(--fg)]">模型列表</p>
                <div className="flex flex-wrap gap-1">
                  {MODEL_CAPABILITY_ORDER.filter((type) =>
                    vendor?.supportedTypes.includes(type),
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="model-provider-add-model-btn border-none bg-transparent p-0"
                      onClick={() => addModel(type)}
                    >
                      + {MODEL_CAPABILITY_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {provider.models.length === 0 ? (
                <p className="model-provider-empty-hint rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center">
                  尚未配置模型。填写凭证后点击「拉取模型」，或手动添加。
                </p>
              ) : (
                MODEL_CAPABILITY_ORDER.map((type) => {
                  const models = grouped[type];
                  if (!models.length) return null;
                  return (
                    <div key={type}>
                      <p className="model-provider-model-group__title">
                        {MODEL_CAPABILITY_LABELS[type]}
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
