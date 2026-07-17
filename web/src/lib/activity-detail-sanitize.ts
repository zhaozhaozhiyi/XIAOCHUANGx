const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";

const SENSITIVE_KEY =
  /^(authorization|proxy-authorization|api[-_]?key|token|access[-_]?token|refresh[-_]?token|secret|client[-_]?secret|password|passwd|cookie|set-cookie|private[-_]?key)$/i;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const COMMON_SECRET = /\b(sk|rk|pk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g;
const INLINE_SECRET =
  /\b(api[-_]?key|token|secret|password|passwd)\s*[:=]\s*["']?[^\s,"']{8,}/gi;
const BASE64_BLOCK = /^[A-Za-z0-9+/=_-]{512,}$/;

export type ActivityDetailSanitizeOptions = {
  maxDepth?: number;
  maxKeys?: number;
  maxArrayItems?: number;
  maxStringLength?: number;
  maxTotalCharacters?: number;
};

function sanitizeString(value: string, maxLength: number): string {
  if (BASE64_BLOCK.test(value)) return `[BINARY_OR_BASE64 ${value.length} chars]`;
  const sanitized = value
    .replace(PRIVATE_KEY, REDACTED)
    .replace(BEARER_TOKEN, `Bearer ${REDACTED}`)
    .replace(COMMON_SECRET, REDACTED)
    .replace(INLINE_SECRET, (match, key: string) => `${key}=${REDACTED}`);
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength)}\n${TRUNCATED}`;
}

export function sanitizeActivityDetail(
  value: unknown,
  options: ActivityDetailSanitizeOptions = {},
): unknown {
  const maxDepth = options.maxDepth ?? 5;
  const maxKeys = options.maxKeys ?? 50;
  const maxArrayItems = options.maxArrayItems ?? 50;
  const maxStringLength = options.maxStringLength ?? 8_000;
  let remaining = options.maxTotalCharacters ?? 24_000;
  const seen = new WeakSet<object>();

  const visit = (input: unknown, depth: number, key?: string): unknown => {
    if (key && SENSITIVE_KEY.test(key)) return REDACTED;
    if (remaining <= 0) return TRUNCATED;
    if (input == null || typeof input === "number" || typeof input === "boolean") {
      return input;
    }
    if (typeof input === "bigint") return input.toString();
    if (typeof input === "string") {
      const sanitized = sanitizeString(input, Math.min(maxStringLength, remaining));
      remaining -= sanitized.length;
      return sanitized;
    }
    if (typeof input === "function" || typeof input === "symbol") {
      return `[${typeof input}]`;
    }
    if (depth >= maxDepth) return `[MAX_DEPTH ${maxDepth}]`;
    if (typeof ArrayBuffer !== "undefined" && input instanceof ArrayBuffer) {
      return `[ARRAY_BUFFER ${input.byteLength} bytes]`;
    }
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(input)) {
      return `[BINARY_VIEW ${input.byteLength} bytes]`;
    }
    if (typeof input !== "object") return String(input);
    if (seen.has(input)) return "[CIRCULAR]";
    seen.add(input);

    if (Array.isArray(input)) {
      const result = input
        .slice(0, maxArrayItems)
        .map((item) => visit(item, depth + 1));
      if (input.length > maxArrayItems) {
        result.push(`[${input.length - maxArrayItems} MORE ITEMS]`);
      }
      return result;
    }

    const entries = Object.entries(input as Record<string, unknown>);
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of entries.slice(0, maxKeys)) {
      result[entryKey] = visit(entryValue, depth + 1, entryKey);
    }
    if (entries.length > maxKeys) {
      result.__truncated__ = `${entries.length - maxKeys} more keys`;
    }
    return result;
  };

  return visit(value, 0);
}

export function formatSanitizedActivityDetail(
  value: unknown,
  options?: ActivityDetailSanitizeOptions,
): string {
  if (value == null || value === "") return "";
  const sanitized = sanitizeActivityDetail(value, options);
  if (typeof sanitized === "string") return sanitized;
  try {
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return "[UNSERIALIZABLE]";
  }
}

