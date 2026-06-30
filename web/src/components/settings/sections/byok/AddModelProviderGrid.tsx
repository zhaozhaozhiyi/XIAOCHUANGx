"use client";

import { Plus } from "lucide-react";
import {
  MODEL_PROVIDER_VENDOR_CATEGORY_LABELS,
  MODEL_PROVIDER_VENDOR_CATEGORY_ORDER,
  createProviderFromVendor,
  vendorsByCategory,
  type ModelProviderVendor,
  type ModelProviderVendorId,
} from "@/lib/byok/model-providers";
import { ModelProviderIcon } from "./ModelProviderIcon";
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
        <span className="flex min-w-0 items-center gap-2">
          <span className="model-vendor-card__icon">
            <ModelProviderIcon vendorId={vendor.id} size={22} />
          </span>
          <span className="model-vendor-card__name">{vendor.name}</span>
        </span>
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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[var(--fg)]">添加模型厂商</p>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          选择厂商后配置凭证并通过连接测试，才会加入已配置列表；同一厂商可添加多个实例
        </p>
      </div>
      {MODEL_PROVIDER_VENDOR_CATEGORY_ORDER.map((category) => {
        const vendors = vendorsByCategory(category);
        if (!vendors.length) return null;
        return (
          <div key={category} className="space-y-2">
            <p className="model-vendor-grid-section__title">
              {MODEL_PROVIDER_VENDOR_CATEGORY_LABELS[category]}
            </p>
            <div className="model-vendor-grid">
              {vendors.map((vendor) => (
                <VendorTile
                  key={vendor.id}
                  vendor={vendor}
                  onAdd={() => onAdd(vendor.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { createProviderFromVendor };
