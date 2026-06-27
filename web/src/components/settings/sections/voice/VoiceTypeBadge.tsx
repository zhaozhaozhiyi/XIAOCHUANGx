"use client";

import {
  VOICE_CAPABILITY_LABELS,
  type VoiceCapabilityType,
} from "@/lib/voice/voice-providers";

const BADGE_CLASS: Record<VoiceCapabilityType, string> = {
  stt: "model-capability-badge model-capability-badge--embedding",
  tts: "model-capability-badge model-capability-badge--multimodal",
};

export function VoiceTypeBadge({ type }: { type: VoiceCapabilityType }) {
  return (
    <span className={BADGE_CLASS[type]}>{VOICE_CAPABILITY_LABELS[type]}</span>
  );
}
