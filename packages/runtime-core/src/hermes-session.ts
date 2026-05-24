/** 跨 Web BFF / Companion 统一的 Hermes 会话键 */

const DEFAULT_NAMESPACE = "jlcresearch";

export function buildHermesSessionKey(
  sessionId: string,
  agentId: string,
  namespace = DEFAULT_NAMESPACE,
): string {
  return `${namespace}:${sessionId.trim()}:${agentId}`;
}

export function buildHermesSessionId(
  sessionId: string,
  namespace = DEFAULT_NAMESPACE,
): string {
  return `${namespace}:${sessionId.trim()}`;
}
