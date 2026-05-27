"use client";

import { Plus } from "lucide-react";
import {
  MODEL_PROVIDER_VENDORS,
  createProviderFromVendor,
  type ModelProviderVendor,
  type ModelProviderVendorId,
} from "@/lib/byok/model-providers";
import { ModelTypeBadge } from "./ModelTypeBadge";

type AddModelProviderGridProps = {
  onAdd: (vendorId: ModelProviderVendorId) => void;
};

function VendorTile({
  vendor,
  onAdd,
}: {
  vendor: ModelProviderVendor;
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
          <ModelTypeBadge key={type} type={type} />
        ))}
      </span>
    </button>
  );
}

export function AddModelProviderGrid({ onAdd }: AddModelProviderGridProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--fg)]">添加模型厂商</p>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          选择厂商后配置凭证并拉取模型；同一厂商可添加多个实例（如不同 Key 或网关）
        </p>
      </div>
      <div className="model-vendor-grid">
        {MODEL_PROVIDER_VENDORS.map((vendor) => (
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

export { createProviderFromVendor };
