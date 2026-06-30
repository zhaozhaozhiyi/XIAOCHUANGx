/** 凭证字段变量名 — 与 ApiProviderConfig 映射 */
export const CREDENTIAL_BASE_URL = "base_url";
export const CREDENTIAL_API_KEY = "api_key";
export const CREDENTIAL_ANTHROPIC_VERSION = "anthropic_version";

export enum FormTypeEnum {
  text = "text",
  secret = "secret",
  select = "select",
  radio = "radio",
}

export type ShowOnCondition = {
  variable: string;
  value: string;
};

export type CredentialFormOption = {
  label: string;
  value: string;
};

export type CredentialFormSchema = {
  variable: string;
  label: string;
  type: FormTypeEnum;
  required: boolean;
  default?: string;
  placeholder?: string;
  options?: CredentialFormOption[];
  show_on?: ShowOnCondition[];
  /** 帮助文档链接 */
  url?: string;
};

export type CredentialValues = Record<string, string>;

export function getInitialCredentials(
  schema: CredentialFormSchema[],
): CredentialValues {
  const values: CredentialValues = {};
  for (const field of schema) {
    values[field.variable] = field.default ?? "";
  }
  return values;
}

export function isFieldVisible(
  field: CredentialFormSchema,
  values: CredentialValues,
): boolean {
  if (!field.show_on?.length) return true;
  return field.show_on.every(
    (cond) => (values[cond.variable] ?? "") === cond.value,
  );
}

/** 返回未填写的必填字段 variable 列表 */
export function validateCredentials(
  schema: CredentialFormSchema[],
  values: CredentialValues,
): string[] {
  const missing: string[] = [];
  for (const field of schema) {
    if (!field.required) continue;
    if (!isFieldVisible(field, values)) continue;
    if (!(values[field.variable] ?? "").trim()) {
      missing.push(field.variable);
    }
  }
  return missing;
}

export function credentialsConnectable(
  schema: CredentialFormSchema[],
  values: CredentialValues,
): boolean {
  return validateCredentials(schema, values).length === 0;
}

export function openAiCompatCredentialSchema(
  defaultBaseUrl: string,
  options?: { keyOptional?: boolean },
): CredentialFormSchema[] {
  return [
    {
      variable: CREDENTIAL_BASE_URL,
      label: "Base URL",
      type: FormTypeEnum.text,
      required: true,
      default: defaultBaseUrl,
      placeholder: defaultBaseUrl,
    },
    {
      variable: CREDENTIAL_API_KEY,
      label: "API Key",
      type: FormTypeEnum.secret,
      required: !options?.keyOptional,
      placeholder: "sk-...",
    },
  ];
}

export function anthropicCredentialSchema(
  defaultBaseUrl: string,
): CredentialFormSchema[] {
  return [
    ...openAiCompatCredentialSchema(defaultBaseUrl),
    {
      variable: CREDENTIAL_ANTHROPIC_VERSION,
      label: "Anthropic Version",
      type: FormTypeEnum.text,
      required: true,
      default: "2023-06-01",
      placeholder: "2023-06-01",
    },
  ];
}

export function credentialsToApiFields(
  credentials: CredentialValues,
): {
  baseUrl: string;
  apiKey: string;
  anthropicVersion: string;
} {
  return {
    baseUrl: (credentials[CREDENTIAL_BASE_URL] ?? "").trim(),
    apiKey: (credentials[CREDENTIAL_API_KEY] ?? "").trim(),
    anthropicVersion:
      (credentials[CREDENTIAL_ANTHROPIC_VERSION] ?? "").trim() || "2023-06-01",
  };
}
