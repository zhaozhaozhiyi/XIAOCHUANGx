import { buildHermesSessionId } from "@jlc/runtime-core/hermes-session";

/** Server-side Hermes API Server settings (BFF → hermes gateway). */

function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export const hermesConfig = {
  /** Base URL, e.g. http://127.0.0.1:8642 */
  baseUrl: (process.env.HERMES_API_URL ?? "http://127.0.0.1:8642").replace(
    /\/$/,
    "",
  ),
  apiKey: process.env.HERMES_API_KEY ?? "",
  model: process.env.HERMES_MODEL ?? "hermes-agent",
  /** Force mock replies (no Hermes process required). */
  useMock: envBool("HERMES_USE_MOCK", false),
  /** Prefix for X-Hermes-Session-Id (isolates web sessions on the gateway). */
  /** 与 Companion Hermes Gateway 共用命名空间（见 runtime-core hermes-session） */
  sessionPrefix: process.env.HERMES_SESSION_PREFIX ?? "jlcresearch",
} as const;

export function hermesChatCompletionsUrl(): string {
  return `${hermesConfig.baseUrl}/v1/chat/completions`;
}

export function hermesHealthUrl(): string {
  return `${hermesConfig.baseUrl}/health`;
}

export function gatewaySessionId(webSessionId: string): string {
  return buildHermesSessionId(webSessionId, hermesConfig.sessionPrefix);
}
