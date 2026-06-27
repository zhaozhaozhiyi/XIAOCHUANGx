const PREVIEW_HOST_ALLOWLIST = new Set([
  "www.baidu.com",
  "baidu.com",
  "www.bing.com",
  "bing.com",
  "example.com",
  "www.example.com",
  "choice.eastmoney.com",
  "eastmoney.com",
  "quote.eastmoney.com",
  "data.eastmoney.com",
]);

export function normalizeBrowserUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^blob:/i.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return null;
    }
  }
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function hostAllowedForProxy(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    PREVIEW_HOST_ALLOWLIST.has(host) ||
    host.endsWith(".eastmoney.com")
  );
}

export function previewProxyUrl(target: string): string {
  return `/api/workspace/preview?url=${encodeURIComponent(target)}`;
}
