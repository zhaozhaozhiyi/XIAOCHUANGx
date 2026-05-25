import {
  getResearchProject,
  isUsingLocalProject,
  NO_PROJECT_ID,
} from "@/lib/research-projects";

/** Agent 执行态（侧栏状态点主维度之一） */
export type ChatSessionRunStatus = "idle" | "running" | "waiting_user";

/** 侧栏展示用四态（由 runStatus + lastReadAt 推导） */
export type ChatSessionIndicator = "read" | "unread" | "running" | "waiting_user";

export type ChatSessionRecord = {
  id: string;
  title: string;
  projectId: string;
  updatedAt: number;
  createdAt: number;
  /** 当前轮 Agent 是否在跑 / 是否等人 */
  runStatus: ChatSessionRunStatus;
  /** 用户上次打开该会话并看到最新结果的时间戳；0 表示从未读过 */
  lastReadAt: number;
};

export type ChatHistoryProjectGroup = {
  projectId: string;
  label: string;
  sessions: ChatSessionRecord[];
};

const INDEX_KEY = "jlc-chat-history-index";
const STARTED_PREFIX = "jlc-chat-started-";

/** 侧栏每个项目默认展示的会话条数 */
export const SIDEBAR_SESSIONS_INITIAL = 8;
/** 点击「查看更多」每次追加条数 */
export const SIDEBAR_SESSIONS_MORE_STEP = 8;

const now = Date.now();

const SEED_SESSIONS: ChatSessionRecord[] = [
  {
    id: "1",
    title: "螺纹钢社会库存环比分析",
    projectId: "proj-mengdian",
    updatedAt: now - 2 * 60 * 60 * 1000,
    createdAt: now - 3 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 2 * 60 * 60 * 1000,
  },
  {
    id: "2",
    title: "碳排放政策对钢铁行业影响",
    projectId: "proj-mengdian",
    updatedAt: now - 26 * 60 * 60 * 1000,
    createdAt: now - 28 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: 0,
  },
  {
    id: "5",
    title: "拉取 bisheng 项目代码",
    projectId: "proj-mengdian",
    updatedAt: now - 2 * 24 * 60 * 60 * 1000,
    createdAt: now - 2 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "6",
    title: "完善文档内容",
    projectId: "proj-mengdian",
    updatedAt: now - 3 * 24 * 60 * 60 * 1000,
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "7",
    title: "分析目标文档结构",
    projectId: "proj-mengdian",
    updatedAt: now - 4 * 24 * 60 * 60 * 1000,
    createdAt: now - 4 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: "8",
    title: "项目工作功能对齐",
    projectId: "proj-mengdian",
    updatedAt: now - 5 * 24 * 60 * 60 * 1000,
    createdAt: now - 5 * 24 * 60 * 60 * 1000,
    runStatus: "waiting_user",
    lastReadAt: now - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: "9",
    title: "Agent 选择器位置调整",
    projectId: "proj-mengdian",
    updatedAt: now - 6 * 24 * 60 * 60 * 1000,
    createdAt: now - 6 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: 0,
  },
  {
    id: "10",
    title: "用户登录后的工作区默认",
    projectId: "proj-mengdian",
    updatedAt: now - 7 * 24 * 60 * 60 * 1000,
    createdAt: now - 7 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: "11",
    title: "底座未链接问题排查",
    projectId: "proj-mengdian",
    updatedAt: now - 9 * 24 * 60 * 60 * 1000,
    createdAt: now - 9 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 9 * 24 * 60 * 60 * 1000,
  },
  {
    id: "3",
    title: "原油供需与价格展望",
    projectId: NO_PROJECT_ID,
    updatedAt: now - 3 * 24 * 60 * 60 * 1000,
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: 0,
  },
  {
    id: "4",
    title: "聚乙烯开工率数据查询",
    projectId: NO_PROJECT_ID,
    updatedAt: now - 8 * 24 * 60 * 60 * 1000,
    createdAt: now - 8 * 24 * 60 * 60 * 1000,
    runStatus: "idle",
    lastReadAt: now - 8 * 24 * 60 * 60 * 1000,
  },
];

function normalizeSession(
  raw: Partial<ChatSessionRecord> & { id: string },
): ChatSessionRecord {
  const seed = SEED_SESSIONS.find((s) => s.id === raw.id);
  const updatedAt =
    typeof raw.updatedAt === "number"
      ? raw.updatedAt
      : (seed?.updatedAt ?? Date.now());
  const runStatus =
    raw.runStatus === "running" ||
    raw.runStatus === "waiting_user" ||
    raw.runStatus === "idle"
      ? raw.runStatus
      : (seed?.runStatus ?? "idle");
  const lastReadAt =
    typeof raw.lastReadAt === "number"
      ? raw.lastReadAt
      : (seed?.lastReadAt ?? 0);

  return {
    id: raw.id,
    title: raw.title ?? seed?.title ?? "新对话",
    projectId: raw.projectId ?? seed?.projectId ?? NO_PROJECT_ID,
    createdAt:
      typeof raw.createdAt === "number"
        ? raw.createdAt
        : (seed?.createdAt ?? updatedAt),
    updatedAt,
    runStatus,
    lastReadAt,
  };
}

export function getSessionIndicator(
  session: ChatSessionRecord,
  options?: { isActive?: boolean },
): ChatSessionIndicator {
  if (session.runStatus === "running") return "running";
  if (session.runStatus === "waiting_user") return "waiting_user";
  if (options?.isActive) return "read";
  if (session.lastReadAt >= session.updatedAt) return "read";
  return "unread";
}

/** SSE / Companion 阶段事件是否表示需要用户介入 */
export function isWaitingUserSignal(label: string, phase?: string): boolean {
  const p = (phase ?? "").toLowerCase();
  if (p === "waiting_user" || p === "input_required" || p === "awaiting_input") {
    return true;
  }
  return /确认|填写|选择|审批|授权|需要您|请补充/.test(label);
}

function readIndex(): ChatSessionRecord[] {
  if (typeof window === "undefined") return [...SEED_SESSIONS];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) {
      writeIndex(SEED_SESSIONS);
      return [...SEED_SESSIONS];
    }
    const parsed = JSON.parse(raw) as Array<Partial<ChatSessionRecord> & { id: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeIndex(SEED_SESSIONS);
      return [...SEED_SESSIONS];
    }
    const byId = new Map<string, ChatSessionRecord>();
    for (const s of SEED_SESSIONS) byId.set(s.id, s);
    for (const s of parsed) {
      if (s?.id && typeof s.title === "string") {
        byId.set(s.id, normalizeSession(s));
      }
    }
    return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [...SEED_SESSIONS];
  }
}

function writeIndex(sessions: ChatSessionRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event("jlc-chat-history-updated"));
}

export function notifyChatHistoryUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("jlc-chat-history-updated"));
}

export function isSessionStarted(sessionId: string): boolean {
  if (typeof window === "undefined") {
    return SEED_SESSIONS.some((s) => s.id === sessionId);
  }
  if (SEED_SESSIONS.some((s) => s.id === sessionId)) return true;
  return localStorage.getItem(`${STARTED_PREFIX}${sessionId}`) === "1";
}

export function markSessionStarted(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STARTED_PREFIX}${sessionId}`, "1");
}

export function patchChatSession(
  sessionId: string,
  partial: Partial<
    Pick<
      ChatSessionRecord,
      "title" | "projectId" | "updatedAt" | "createdAt" | "runStatus" | "lastReadAt"
    >
  >,
): ChatSessionRecord | undefined {
  const list = readIndex();
  const existing = list.find((s) => s.id === sessionId);
  if (!existing) return undefined;
  const next: ChatSessionRecord = { ...existing, ...partial };
  const without = list.filter((s) => s.id !== sessionId);
  writeIndex([next, ...without]);
  return next;
}

export function setSessionRunStatus(
  sessionId: string,
  runStatus: ChatSessionRunStatus,
  opts?: { touchUpdatedAt?: boolean },
): void {
  patchChatSession(sessionId, {
    runStatus,
    ...(opts?.touchUpdatedAt ? { updatedAt: Date.now() } : {}),
  });
}

/** 用户打开会话并看到最新内容后调用 */
export function markSessionRead(sessionId: string): void {
  const session = getChatSession(sessionId);
  if (!session) return;
  const ts = Math.max(Date.now(), session.updatedAt);
  patchChatSession(sessionId, { lastReadAt: ts });
}

export function upsertChatSession(
  partial: Pick<ChatSessionRecord, "id"> &
    Partial<
      Pick<
        ChatSessionRecord,
        | "title"
        | "projectId"
        | "updatedAt"
        | "createdAt"
        | "runStatus"
        | "lastReadAt"
      >
    >,
): ChatSessionRecord {
  const now = Date.now();
  const list = readIndex();
  const existing = list.find((s) => s.id === partial.id);
  const next: ChatSessionRecord = {
    id: partial.id,
    title: partial.title ?? existing?.title ?? "新对话",
    projectId: partial.projectId ?? existing?.projectId ?? NO_PROJECT_ID,
    createdAt: partial.createdAt ?? existing?.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    runStatus: partial.runStatus ?? existing?.runStatus ?? "idle",
    lastReadAt: partial.lastReadAt ?? existing?.lastReadAt ?? 0,
  };
  const without = list.filter((s) => s.id !== partial.id);
  writeIndex([next, ...without]);
  return next;
}

export function getChatSession(sessionId: string): ChatSessionRecord | undefined {
  return readIndex().find((s) => s.id === sessionId);
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 60) return min <= 1 ? "刚刚" : `${min} 分钟`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天`;
  return `${Math.floor(day / 7)} 周`;
}

function projectGroupLabel(projectId: string): string {
  if (!isUsingLocalProject(projectId)) return "无项目";
  return getResearchProject(projectId)?.name ?? "未命名项目";
}

export type GroupedChatHistory = {
  projectGroups: ChatHistoryProjectGroup[];
  unassigned: ChatSessionRecord[];
};

function groupChatSessions(sessions: ChatSessionRecord[]): GroupedChatHistory {
  const byProject = new Map<string, ChatSessionRecord[]>();
  const unassigned: ChatSessionRecord[] = [];

  for (const s of sessions) {
    if (!isUsingLocalProject(s.projectId)) {
      unassigned.push(s);
      continue;
    }
    const list = byProject.get(s.projectId) ?? [];
    list.push(s);
    byProject.set(s.projectId, list);
  }

  const projectGroups: ChatHistoryProjectGroup[] = [...byProject.entries()]
    .map(([projectId, list]) => ({
      projectId,
      label: projectGroupLabel(projectId),
      sessions: list.sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .sort(
      (a, b) =>
        (b.sessions[0]?.updatedAt ?? 0) - (a.sessions[0]?.updatedAt ?? 0),
    );

  unassigned.sort((a, b) => b.updatedAt - a.updatedAt);

  return { projectGroups, unassigned };
}

/** SSR / 注水前稳定快照（仅种子数据，不读 localStorage；引用稳定供 useSyncExternalStore） */
const GROUPED_CHAT_HISTORY_SERVER_SNAPSHOT: GroupedChatHistory = groupChatSessions([
  ...SEED_SESSIONS,
]);

export function getGroupedChatHistoryServerSnapshot(): GroupedChatHistory {
  return GROUPED_CHAT_HISTORY_SERVER_SNAPSHOT;
}

/** Codex 式：按项目分组；无项目会话置底 */
export function getGroupedChatHistory(): GroupedChatHistory {
  return groupChatSessions(readIndex());
}

/** @deprecated 使用 getGroupedChatHistory / getChatSession */
export const MOCK_CHAT_HISTORY = SEED_SESSIONS.map((s) => ({
  id: s.id,
  title: s.title,
  time: formatRelativeTime(s.updatedAt),
}));
