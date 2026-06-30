"use client";

import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import {
  FormTypeEnum,
  isFieldVisible,
  type CredentialFormSchema,
  type CredentialValues,
} from "@/lib/byok/credential-schema";

type CredentialFormProps = {
  schema: CredentialFormSchema[];
  values: CredentialValues;
  onChange: (next: CredentialValues) => void;
};

function SecretInput({
  field,
  value,
  onChange,
}: {
  field: CredentialFormSchema;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className="model-provider-input pr-10"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]"
        aria-label={visible ? "隐藏" : "显示"}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

function FieldLabel({
  field,
}: {
  field: CredentialFormSchema;
}) {
  return (
    <span className="text-overline flex items-center gap-1.5">
      {field.label}
      {field.required ? (
        <span className="text-[10px] text-[var(--fg-tertiary)]">*</span>
      ) : (
        <span className="text-[10px] font-normal text-[var(--fg-tertiary)]">
          可选
        </span>
      )}
      {field.url && (
        <a
          href={field.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-normal text-[var(--accent)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          文档
        </a>
      )}
    </span>
  );
}

export function CredentialForm({
  schema,
  values,
  onChange,
}: CredentialFormProps) {
  const visibleFields = useMemo(
    () => schema.filter((field) => isFieldVisible(field, values)),
    [schema, values],
  );

  const patch = (variable: string, value: string) => {
    onChange({ ...values, [variable]: value });
  };

  if (!visibleFields.length) return null;

  return (
    <div className="space-y-3">
      {visibleFields.map((field) => (
        <label key={field.variable} className="block space-y-1">
          <FieldLabel field={field} />
          {field.type === FormTypeEnum.secret ? (
            <SecretInput
              field={field}
              value={values[field.variable] ?? ""}
              onChange={(next) => patch(field.variable, next)}
            />
          ) : field.type === FormTypeEnum.select ? (
            <select
              className="model-provider-input"
              value={values[field.variable] ?? ""}
              onChange={(e) => patch(field.variable, e.target.value)}
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : field.type === FormTypeEnum.radio ? (
            <div className="flex flex-wrap gap-3 pt-1">
              {(field.options ?? []).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 text-sm text-[var(--fg-secondary)]"
                >
                  <input
                    type="radio"
                    name={field.variable}
                    className="accent-[var(--accent)]"
                    checked={(values[field.variable] ?? "") === opt.value}
                    onChange={() => patch(field.variable, opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          ) : (
            <input
              className="model-provider-input"
              value={values[field.variable] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => patch(field.variable, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
