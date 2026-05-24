export { AGENT_IDS, isAgentId } from "./types.js";
export type { AgentId } from "./types.js";
export {
  STATIC_AGENT_REGISTRY as AGENT_CATALOG,
  getStaticAgentRegistryEntry as getAgentCatalogEntry,
  listStaticAgentRegistryEntries as listAgentCatalogEntries,
} from "./agent-registry-static.js";
export type {
  AgentExecutionProfile,
  AgentModelOption,
  StaticAgentRegistryEntry as AgentCatalogEntry,
} from "./agent-registry-static.js";
