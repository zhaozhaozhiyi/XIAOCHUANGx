"use client";

import { Plus } from "lucide-react";
import {
  VOICE_PROVIDER_VENDORS,
  createVoiceProviderFromVendor,
  type VoiceProviderVendor,
  type VoiceProviderVendorId,
} from "@/lib/voice/voice-providers";
import { VoiceTypeBadge } from "./VoiceTypeBadge";

type AddVoiceProviderGridProps = {
  onAdd: (vendorId: VoiceProviderVendorId) => void;
};

function VendorTile({
  vendor,
  onAdd,
}: {
  vendor: VoiceProviderVendor;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      className="model-vendor-card group"
      style={{ ["--vendor-accent" as string]: vendor.accent }}
      onClick={onAdd}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="model-vendor-card__name">{vendor.name}</span>
        <Plus
          className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
        />
      </span>
      <span className="model-vendor-card__desc">{vendor.description}</span>
      <span className="flex flex-wrap gap-1">
        {vendor.supportedTypes.map((type) => (
          <VoiceTypeBadge key={type} type={type} />
        ))}
      </span>
    </button>
  );
}

export function AddVoiceProviderGrid({ onAdd }: AddVoiceProviderGridProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--fg)]">添加语音厂商</p>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          配置语音识别（STT）与语音合成（TTS）Provider，供会议纪要、对话朗读等场景使用
        </p>
      </div>
      <div className="model-vendor-grid">
        {VOICE_PROVIDER_VENDORS.map((vendor) => (
          <VendorTile
            key={vendor.id}
            vendor={vendor}
            onAdd={() => onAdd(vendor.id)}
          />
        ))}
      </div>
    </div>
  );
}

export { createVoiceProviderFromVendor };
