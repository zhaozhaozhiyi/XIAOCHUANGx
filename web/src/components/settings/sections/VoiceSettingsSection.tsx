"use client";

import { Mic } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import {
  AddVoiceProviderGrid,
  createVoiceProviderFromVendor,
} from "@/components/settings/sections/voice/AddVoiceProviderGrid";
import { VoiceProviderCard } from "@/components/settings/sections/voice/VoiceProviderCard";
import {
  defaultVoiceSelection,
  getVoiceModelsByType,
  hasAnyUsableVoiceProvider,
  resolveVoiceSelection,
  type VoiceModelSelection,
  type VoiceProviderInstance,
  type VoiceProviderVendorId,
} from "@/lib/voice/voice-providers";

function selectionKey(selection: VoiceModelSelection | null): string {
  if (!selection) return "";
  return `${selection.providerId}:${selection.modelEntryId}`;
}

function DefaultVoiceSelector({
  label,
  type,
  providers,
  value,
  onChange,
}: {
  label: string;
  type: "stt" | "tts";
  providers: VoiceProviderInstance[];
  value: VoiceModelSelection | null;
  onChange: (next: VoiceModelSelection | null) => void;
}) {
  const options = useMemo(
    () => getVoiceModelsByType(providers, type),
    [providers, type],
  );
  const currentKey = selectionKey(value);

  return (
    <label className="space-y-1">
      <span className="text-overline">{label}</span>
      <select
        className="model-provider-input"
        value={currentKey}
        disabled={!options.length}
        onChange={(e) => {
          const key = e.target.value;
          if (!key) {
            onChange(null);
            return;
          }
          const [providerId, modelEntryId] = key.split(":");
          onChange({ providerId: providerId!, modelEntryId: modelEntryId! });
        }}
      >
        <option value="">
          {options.length ? "请选择默认模型" : "暂无可用模型"}
        </option>
        {options.map(({ provider, model }) => (
          <option
            key={`${provider.id}:${model.id}`}
            value={`${provider.id}:${model.id}`}
          >
            {provider.displayName} · {model.label || model.modelId}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VoiceSettingsSection() {
  const { settings, updateSettings } = useSettings();
  const providers = settings.voiceProviders;
  const [expandedId, setExpandedId] = useState<string | null>(
    providers[0]?.id ?? null,
  );

  const sttModels = useMemo(() => getVoiceModelsByType(providers, "stt"), [providers]);
  const ttsModels = useMemo(() => getVoiceModelsByType(providers, "tts"), [providers]);
  const hasUsable = hasAnyUsableVoiceProvider(providers);

  const updateProviders = useCallback(
    (
      nextProviders: VoiceProviderInstance[],
      options?: {
        defaultSttSelection?: VoiceModelSelection | null;
        defaultTtsSelection?: VoiceModelSelection | null;
      },
    ) => {
      let defaultSttSelection =
        options?.defaultSttSelection ?? settings.defaultSttSelection;
      let defaultTtsSelection =
        options?.defaultTtsSelection ?? settings.defaultTtsSelection;

      if (
        defaultSttSelection &&
        !resolveVoiceSelection(nextProviders, defaultSttSelection, "stt")
      ) {
        defaultSttSelection = defaultVoiceSelection(nextProviders, "stt");
      }
      if (
        defaultTtsSelection &&
        !resolveVoiceSelection(nextProviders, defaultTtsSelection, "tts")
      ) {
        defaultTtsSelection = defaultVoiceSelection(nextProviders, "tts");
      }

      updateSettings({
        voiceProviders: nextProviders,
        defaultSttSelection,
        defaultTtsSelection,
        voiceEnabled: hasAnyUsableVoiceProvider(nextProviders),
      });
    },
    [
      settings.defaultSttSelection,
      settings.defaultTtsSelection,
      updateSettings,
    ],
  );

  const handleAddProvider = (vendorId: VoiceProviderVendorId) => {
    const created = createVoiceProviderFromVendor(vendorId);
    const next = [...providers, created];
    setExpandedId(created.id);
    updateProviders(next);
  };

  const handleChangeProvider = (
    id: string,
    nextProvider: VoiceProviderInstance,
  ) => {
    updateProviders(
      providers.map((p) => (p.id === id ? nextProvider : p)),
    );
  };

  const handleRemoveProvider = (id: string) => {
    const next = providers.filter((p) => p.id !== id);
    if (expandedId === id) {
      setExpandedId(next[0]?.id ?? null);
    }
    updateProviders(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--fg-secondary)]">
          配置语音识别（STT）与语音合成（TTS）Provider，用于后续会议音频处理、对话朗读等能力。与文本模型 API
          独立管理，后续可在各业务模块中选用默认语音模型。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--fg-secondary)]">
            已配置 {providers.length} 个 Provider
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--fg-secondary)]">
            STT {sttModels.length} · TTS {ttsModels.length}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 ${
              hasUsable
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {hasUsable ? "语音能力可用" : "尚未配置可用语音模型"}
          </span>
        </div>
      </div>

      <label className="model-api-global-toggle">
        <span>
          <span className="block font-medium text-[var(--fg)]">启用语音模型</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)]">
            开启后业务模块可使用下方默认 STT / TTS 配置
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={settings.voiceEnabled}
          onChange={(e) => updateSettings({ voiceEnabled: e.target.checked })}
        />
      </label>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-sm font-medium text-[var(--fg)]">默认语音模型</p>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          全局默认选型，可在后续会议音频处理、对话朗读等场景中覆盖
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <DefaultVoiceSelector
            label="默认语音识别（STT）"
            type="stt"
            providers={providers}
            value={settings.defaultSttSelection}
            onChange={(defaultSttSelection) =>
              updateSettings({ defaultSttSelection })
            }
          />
          <DefaultVoiceSelector
            label="默认语音合成（TTS）"
            type="tts"
            providers={providers}
            value={settings.defaultTtsSelection}
            onChange={(defaultTtsSelection) =>
              updateSettings({ defaultTtsSelection })
            }
          />
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="model-provider-empty-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm">
            <Mic className="h-5 w-5 text-[var(--fg)]" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--fg)]">
            尚未配置语音厂商
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--fg-tertiary)]">
            从下方选择 OpenAI Whisper、Azure Speech、阿里云等厂商，配置 API Key 并添加 STT / TTS
            模型。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--fg)]">已配置的厂商</p>
          {providers.map((provider) => (
            <VoiceProviderCard
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
            />
          ))}
        </div>
      )}

      <AddVoiceProviderGrid onAdd={handleAddProvider} />

      <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs leading-6 text-[var(--fg-tertiary)]">
        当前为前端原型：连接测试为 Mock，尚未接入真实语音 API。TTS 模型可额外配置 voice-id
        与语言；后续将与会议音频处理、对话朗读等能力打通。
      </div>
    </div>
  );
}
