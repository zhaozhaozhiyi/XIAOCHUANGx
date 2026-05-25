const BINARY_EXT = /\.(pptx|docx|xlsx|pdf|png|jpe?g|gif|webp)$/i;

export function isBinaryWorkspacePath(relPath: string): boolean {
  return BINARY_EXT.test(relPath.toLowerCase());
}

export function inferMimeFromPath(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/** Strip data-URL prefix and whitespace from API/base64 payloads. */
export function normalizeBase64Payload(raw: string): string {
  const trimmed = raw.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) {
    return trimmed.slice(comma + 1).replace(/\s/g, "");
  }
  return trimmed.replace(/\s/g, "");
}

export function isLikelyZipBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new DataView(buffer);
  const sig = view.getUint32(0, true);
  // PK\x03\x04 (local file) or PK\x05\x06 (empty archive)
  return sig === 0x04034b50 || sig === 0x06054b50;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = normalizeBase64Payload(base64);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
