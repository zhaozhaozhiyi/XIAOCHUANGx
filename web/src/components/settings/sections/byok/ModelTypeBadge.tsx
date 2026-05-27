"use client";

import {
  MODEL_CAPABILITY_LABELS,
  type ModelCapabilityType,
} from "@/lib/byok/model-providers";

export function ModelTypeBadge({ type }: { type: ModelCapabilityType }) {
  return (
    <span className={`model-capability-badge model-capability-badge--${type}`}>
      {MODEL_CAPABILITY_LABELS[type]}
    </span>
  );
}
