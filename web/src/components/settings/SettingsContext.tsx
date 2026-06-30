"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAgentsResponse,
  EMPTY_AGENTS_RUNTIME,
  type AgentsRuntimeState,
} from "@/lib/agents-runtime";
import type { AgentId } from "@/lib/settings";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AgentSettingsTab,
  type SettingsSectionId,
  type UserSettings,
} from "@/lib/settings";
import { syncLegacyApiProvider } from "@/lib/byok/model-providers";

export type OpenDrawerOptions = {
  agentTab?: AgentSettingsTab;
};

/** @deprecated 旧入口 id，openDrawer 会自动映射到 agent + API Tab */
export type LegacySettingsSectionId = SettingsSectionId | "byok";

type AgentTestState = {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
};

type SettingsContextValue = {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  drawerOpen: boolean;
  drawerSection: SettingsSectionId | null;
  agentSettingsTab: AgentSettingsTab;
  setAgentSettingsTab: (tab: AgentSettingsTab) => void;
  openDrawer: (
    section: LegacySettingsSectionId,
    options?: OpenDrawerOptions,
  ) => void;
  closeDrawer: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  saveStatus: "idle" | "saving" | "saved";
  agentsRuntime: AgentsRuntimeState;
  refreshAgents: (options?: {
    detect?: boolean;
  }) => Promise<{ available: number; error: string | null }>;
  agentTest: AgentTestState;
  runAgentTest: (agentId: AgentId) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

async function fetchAgentsPayload(detect: boolean): Promise<{
  ok: boolean;
  execution?: string;
  version?: string;
  mode?: string;
  agents?: AgentsRuntimeState["agents"];
  inferenceChannel?: AgentsRuntimeState["inferenceChannel"];
  count?: number;
  error?: string;
}> {
  const res = await fetch("/api/agents", {
    method: detect ? "POST" : "GET",
  });
  return (await res.json().catch(() => ({}))) as {
    ok: boolean;
    execution?: string;
    version?: string;
    mode?: string;
    agents?: AgentsRuntimeState["agents"];
    inferenceChannel?: AgentsRuntimeState["inferenceChannel"];
    count?: number;
    error?: string;
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<SettingsSectionId | null>(
    null,
  );
  const [agentSettingsTab, setAgentSettingsTab] =
    useState<AgentSettingsTab>("cli");
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [agentsRuntime, setAgentsRuntime] =
    useState<AgentsRuntimeState>(EMPTY_AGENTS_RUNTIME);
  const [agentTest, setAgentTest] = useState<AgentTestState>({
    status: "idle",
  });

  const refreshAgents = useCallback(async (options?: { detect?: boolean }) => {
    setAgentsRuntime((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const payload = await fetchAgentsPayload(!!options?.detect);
      const execution =
        payload.execution === "companion"
          ? "companion"
          : payload.execution === "hermes"
            ? "hermes"
            : "unknown";

      if (!payload.agents?.length && !payload.ok) {
        const error = payload.error ?? "无法连接智能体运行时";
        setAgentsRuntime({
          ...EMPTY_AGENTS_RUNTIME,
          loaded: true,
          loading: false,
          error,
          execution,
          mode: "unreachable",
        });
        return { available: 0, error };
      }

      const agents = payload.agents ?? [];
      const available = agents.filter((a) => a.status === "available").length;
      setAgentsRuntime(
        applyAgentsResponse(
          {
            agents,
            inferenceChannel: payload.inferenceChannel ?? "api_fallback",
          },
          {
            execution,
            companionOk: !!payload.ok,
            companionVersion: payload.version ?? null,
            mode:
              payload.mode === "mock"
                ? "mock"
                : payload.mode === "live"
                  ? "live"
                  : "unreachable",
          },
        ),
      );
      return { available, error: null };
    } catch (err) {
      const error = err instanceof Error ? err.message : "探测失败";
      setAgentsRuntime({
        ...EMPTY_AGENTS_RUNTIME,
        loaded: true,
        loading: false,
        error,
      });
      return { available: 0, error };
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshAgents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAgents]);

  useEffect(() => {
    if (!drawerOpen || drawerSection !== "agent") return;
    const timer = window.setTimeout(() => {
      void refreshAgents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [drawerOpen, drawerSection, refreshAgents]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const merged = { ...prev, ...patch };
        const modelProviders = merged.modelProviders ?? prev.modelProviders;
        const activeApiSelection =
          merged.activeApiSelection !== undefined
            ? merged.activeApiSelection
            : prev.activeApiSelection;
        const next: UserSettings = {
          ...merged,
          modelProviders,
          activeApiSelection,
          apiProvider: syncLegacyApiProvider(
            modelProviders,
            activeApiSelection,
            merged.apiProvider ?? prev.apiProvider,
          ),
        };
        saveSettings(next);
      setSaveStatus("saving");
      window.setTimeout(() => setSaveStatus("saved"), 400);
      window.setTimeout(() => setSaveStatus("idle"), 2200);
        return next;
      });
    },
    [],
  );

  const runAgentTest = useCallback(async (agentId: AgentId) => {
    setAgentTest({ status: "running" });
    try {
      const res = await fetch("/api/agents/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (payload.ok) {
        setAgentTest({ status: "ok", message: payload.message });
      } else {
        setAgentTest({
          status: "error",
          message: payload.message ?? "测试未通过",
        });
      }
    } catch (err) {
      setAgentTest({
        status: "error",
        message: err instanceof Error ? err.message : "测试失败",
      });
    }
    window.setTimeout(() => setAgentTest({ status: "idle" }), 4000);
  }, []);

  const openDrawer = useCallback(
    (section: LegacySettingsSectionId, options?: OpenDrawerOptions) => {
      if (section === "byok") {
        setDrawerSection("agent");
        setAgentSettingsTab("api");
      } else {
        setDrawerSection(section);
        if (section === "agent") {
          setAgentSettingsTab(options?.agentTab ?? "cli");
        }
      }
      setDrawerOpen(true);
      setMenuOpen(false);
    },
    [],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      drawerOpen,
      drawerSection,
      agentSettingsTab,
      setAgentSettingsTab,
      openDrawer,
      closeDrawer,
      menuOpen,
      setMenuOpen,
      saveStatus,
      agentsRuntime,
      refreshAgents,
      agentTest,
      runAgentTest,
    }),
    [
      settings,
      updateSettings,
      drawerOpen,
      drawerSection,
      agentSettingsTab,
      openDrawer,
      closeDrawer,
      menuOpen,
      saveStatus,
      agentsRuntime,
      refreshAgents,
      agentTest,
      runAgentTest,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
