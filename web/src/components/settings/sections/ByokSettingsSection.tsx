"use client";

import { BrainCircuit } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import {
  AddModelProviderGrid,
  createProviderFromVendor,
} from "@/components/settings/sections/byok/AddModelProviderGrid";
import { ModelProviderCard } from "@/components/settings/sections/byok/ModelProviderCard";
import {
  defaultApiSelection,
  getLlmModels,
  hasAnyUsableProvider,
  isListedProvider,
  resolveApiSelection,
  type ModelProviderInstance,
  type ModelProviderVendorId,
} from "@/lib/byok/model-providers";

export function ByokSettingsSection() {
  const { settings, updateSettings } = useSettings();
  const providers = settings.modelProviders;
  const configuredProviders = useMemo(
    () => providers.filter(isListedProvider),
    [providers],
  );
  const [draftProvider, setDraftProvider] =
    useState<ModelProviderInstance | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    configuredProviders[0]?.id ?? null,
  );

  const llmModels = useMemo(() => getLlmModels(providers), [providers]);
  const hasUsable = hasAnyUsableProvider(providers);

  const updateProviders = useCallback(
    (
      nextProviders: ModelProviderInstance[],
      options?: { activeApiSelection?: typeof settings.activeApiSelection },
    ) => {
      let activeApiSelection =
        options?.activeApiSelection ?? settings.activeApiSelection;

      if (
        activeApiSelection &&
        !resolveApiSelection(nextProviders, activeApiSelection)
      ) {
        activeApiSelection = defaultApiSelection(nextProviders);
      }

      updateSettings({
        modelProviders: nextProviders,
        activeApiSelection,
      });
    },
    [settings.activeApiSelection, updateSettings],
  );

  const handleAddProvider = (vendorId: ModelProviderVendorId) => {
    const created = createProviderFromVendor(vendorId);
    setDraftProvider(created);
    setExpandedId(created.id);
  };

  const handleDraftVerified = (verified: ModelProviderInstance) => {
    const next = [...providers, { ...verified, connectionVerified: true }];
    setDraftProvider(null);
    setExpandedId(verified.id);
    updateProviders(next);
  };

  const handleCancelDraft = () => {
    setDraftProvider(null);
    setExpandedId(configuredProviders[0]?.id ?? null);
  };

  const handleChangeProvider = (
    id: string,
    nextProvider: ModelProviderInstance,
  ) => {
    updateProviders(
      providers.map((p) => (p.id === id ? nextProvider : p)),
    );
  };

  const handleRemoveProvider = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    if (expandedId === id) {
      setExpandedId(next.find(isListedProvider)?.id ?? null);
    }
    updateProviders(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--fg-secondary)]">
          管理多个模型厂商与凭证，按文本、多模态、Embedding 等能力分类。保存后可在对话顶栏选择「模型
          API」作为执行通道。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--fg-secondary)]">
            已配置 {configuredProviders.length} 个 Provider
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--fg-secondary)]">
            对话可用 {llmModels.length} 个文本模型
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 ${
              hasUsable
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {hasUsable ? "至少一个 Provider 可用于对话" : "尚未有可用的对话模型"}
          </span>
        </div>
      </div>

      {llmModels.length > 0 && (
        <label className="space-y-1">
          <span className="text-overline">默认对话模型</span>
          <select
            className="model-provider-input"
            value={
              settings.activeApiSelection
                ? `${settings.activeApiSelection.providerId}:${settings.activeApiSelection.modelEntryId}`
                : ""
            }
            onChange={(e) => {
              const [providerId, modelEntryId] = e.target.value.split(":");
              if (!providerId || !modelEntryId) return;
              updateSettings({
                activeApiSelection: { providerId, modelEntryId },
              });
            }}
          >
            {llmModels.map(({ provider, model }) => (
              <option
                key={`${provider.id}:${model.id}`}
                value={`${provider.id}:${model.id}`}
              >
                {provider.displayName} · {model.label || model.modelId}
              </option>
            ))}
          </select>
        </label>
      )}

      {draftProvider && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fg)]">配置新厂商</p>
          <p className="text-xs text-[var(--fg-tertiary)]">
            填写凭证并测试连接通过后，才会加入已配置列表。
          </p>
          <ModelProviderCard
            provider={draftProvider}
            expanded={expandedId === draftProvider.id}
            isDraft
            onToggleExpand={() =>
              setExpandedId((cur) =>
                cur === draftProvider.id ? null : draftProvider.id,
              )
            }
            onChange={setDraftProvider}
            onRemove={handleCancelDraft}
            onConnectionVerified={handleDraftVerified}
          />
        </div>
      )}

      {configuredProviders.length === 0 && !draftProvider ? (
        <div className="model-provider-empty-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm">
            <BrainCircuit className="h-5 w-5 text-[var(--fg)]" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--fg)]">
            尚未配置模型厂商
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--fg-tertiary)]">
            从下方选择 OpenAI、Anthropic、DeepSeek 等厂商，填写凭证并通过连接测试后才会出现在这里。
          </p>
        </div>
      ) : configuredProviders.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fg)]">已配置的厂商</p>
          {configuredProviders.map((provider) => (
            <ModelProviderCard
              key={provider.id}
              provider={provider}
              expanded={expandedId === provider.id}
              onToggleExpand={() =>
                setExpandedId((cur) =>
                  cur === provider.id ? null : provider.id,
                )
              }
              onChange={(next) => handleChangeProvider(provider.id, next)}
              onRemove={() => handleRemoveProvider(provider.id)}
              onConnectionVerified={(verified) =>
                handleChangeProvider(provider.id, verified)
              }
            />
          ))}
        </div>
      ) : null}

      <AddModelProviderGrid onAdd={handleAddProvider} />

      <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs leading-6 text-[var(--fg-tertiary)]">
        MVP 先支持 OpenAI 兼容与 Anthropic 两种协议；厂商卡片仅作分类与默认值引导，底层仍走统一对话编排与
        SSE 事件流。Embedding / Rerank 模型预留给后续检索类场景，暂不参与对话顶栏选型。
      </div>
    </div>
  );
}
