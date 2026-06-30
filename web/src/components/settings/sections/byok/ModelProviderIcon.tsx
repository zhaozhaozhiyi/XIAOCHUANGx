import type { ModelProviderVendorId } from "@/lib/byok/model-providers";

type Props = {
  vendorId: ModelProviderVendorId;
  size?: number;
  className?: string;
};

const VENDOR_ICON_FILE: Record<ModelProviderVendorId, string> = {
  openai: "openai",
  anthropic: "anthropic",
  openrouter: "openrouter",
  deepseek: "deepseek",
  "azure-openai": "azure",
  gemini: "gemini",
  groq: "groq",
  mistral: "mistral",
  xai: "xai",
  ollama: "ollama",
  xinference: "xinference",
  moonshot: "moonshotai",
  zhipu: "zhipu",
  siliconflow: "siliconflow",
  tongyi: "tongyi",
  baichuan: "baichuan",
  minimax: "minimax",
  "custom-openai": "custom-openai",
  "custom-anthropic": "custom-anthropic",
};

export function ModelProviderIcon({ vendorId, size = 28, className }: Props) {
  const file = VENDOR_ICON_FILE[vendorId];
  const src = `/provider-icons/${file}.svg`;

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      aria-hidden="true"
      draggable={false}
    />
  );
}
