"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { ChatSessionStatusIndicator } from "./ChatSessionStatusIndicator";
import {
  formatRelativeTime,
  getSessionIndicator,
  SIDEBAR_SESSIONS_INITIAL,
  SIDEBAR_SESSIONS_MORE_STEP,
  type ChatSessionRecord,
} from "@/lib/chat-history";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useResearchProjects } from "@/contexts/ResearchProjectsContext";
import { NO_PROJECT_ID } from "@/lib/research-projects";

const COLLAPSE_STORAGE_KEY = "jlc-sidebar-project-collapsed";

function readCollapsedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeCollapsedGroups(next: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
}

export function ChatHistorySidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectGroups, unassigned } = useChatHistory();
  const { getProject } = useResearchProjects();

  const resolvedGroups = projectGroups.map((group) => ({
    ...group,
    label: getProject(group.projectId)?.name ?? group.label,
  }));
  const activeId = pathname.match(/^\/chat\/([^/]+)$/)?.[1];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    setCollapsedGroups(readCollapsedGroups());
  }, []);
  const [visibleByGroup, setVisibleByGroup] = useState<Record<string, number>>(
    {},
  );

  const toggleGroupCollapsed = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      writeCollapsedGroups(next);
      return next;
    });
  }, []);

  const startChatInProject = useCallback(
    (projectId: string) => {
      if (projectId === NO_PROJECT_ID) {
        router.push("/chat");
        return;
      }
      router.push(`/chat?project=${encodeURIComponent(projectId)}`);
    },
    [router],
  );

  const getVisibleCount = useCallback(
    (groupKey: string, total: number) => {
      const n = visibleByGroup[groupKey] ?? SIDEBAR_SESSIONS_INITIAL;
      return Math.min(n, total);
    },
    [visibleByGroup],
  );

  const loadMore = useCallback((groupKey: string, total: number) => {
    setVisibleByGroup((prev) => {
      const current = prev[groupKey] ?? SIDEBAR_SESSIONS_INITIAL;
      return {
        ...prev,
        [groupKey]: Math.min(total, current + SIDEBAR_SESSIONS_MORE_STEP),
      };
    });
  }, []);

  return (
    <div className="chat-history-sidebar">
      {resolvedGroups.map((group) => (
        <HistoryGroupSection
          key={group.projectId}
          groupKey={group.projectId}
          label={group.label}
          projectId={group.projectId}
          sessions={group.sessions}
          activeId={activeId}
          collapsed={!!collapsedGroups[group.projectId]}
          onToggleCollapsed={() => toggleGroupCollapsed(group.projectId)}
          onNewChat={() => startChatInProject(group.projectId)}
          visibleCount={getVisibleCount(group.projectId, group.sessions.length)}
          onLoadMore={() => loadMore(group.projectId, group.sessions.length)}
        />
      ))}

      {unassigned.length > 0 && (
        <HistoryGroupSection
          groupKey="__unassigned__"
          label="无项目"
          projectId={NO_PROJECT_ID}
          muted
          sessions={unassigned}
          activeId={activeId}
          collapsed={!!collapsedGroups.__unassigned__}
          onToggleCollapsed={() => toggleGroupCollapsed("__unassigned__")}
          onNewChat={() => startChatInProject(NO_PROJECT_ID)}
          visibleCount={getVisibleCount("__unassigned__", unassigned.length)}
          onLoadMore={() => loadMore("__unassigned__", unassigned.length)}
          last
        />
      )}
    </div>
  );
}

function HistoryGroupSection({
  label,
  sessions,
  activeId,
  visibleCount,
  onLoadMore,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  muted,
  last,
}: {
  groupKey: string;
  label: string;
  projectId: string;
  sessions: ChatSessionRecord[];
  activeId?: string;
  visibleCount: number;
  onLoadMore: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  muted?: boolean;
  last?: boolean;
}) {
  const visible = sessions.slice(0, visibleCount);
  const hasMore = sessions.length > visibleCount;

  return (
    <section
      className={`chat-history-sidebar__section ${last ? "chat-history-sidebar__section--last" : ""}`}
    >
      <div
        className={`chat-history-sidebar__project ${muted ? "chat-history-sidebar__project--muted" : ""}`}
      >
        <div className="chat-history-sidebar__project-text">
          <button
            type="button"
            className="chat-history-sidebar__project-label"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `展开「${label}」` : `收起「${label}」`}
          >
            <span className="truncate">{label}</span>
            <ChevronDown
              className={`chat-history-sidebar__chevron h-3.5 w-3.5 shrink-0 ${collapsed ? "chat-history-sidebar__chevron--collapsed" : ""}`}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            className="chat-history-sidebar__project-new"
            onClick={onNewChat}
            aria-label={`在「${label}」下新建对话`}
            title={`在「${label}」下新建对话`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          <ul className="chat-history-sidebar__list">
            {visible.map((item) => (
              <ChatHistoryItem
                key={item.id}
                session={item}
                active={activeId === item.id}
              />
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="chat-history-sidebar__more"
              onClick={onLoadMore}
            >
              查看更多
              <span className="text-[var(--fg-tertiary)]">
                （{sessions.length - visibleCount}）
              </span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ChatHistoryItem({
  session,
  active,
}: {
  session: ChatSessionRecord;
  active: boolean;
}) {
  const indicator = getSessionIndicator(session, { isActive: active });

  return (
    <li>
      <Link
        href={`/chat/${session.id}`}
        className={`chat-history-sidebar__item ${active ? "chat-history-sidebar__item--active" : ""}`}
      >
        <ChatSessionStatusIndicator indicator={indicator} />
        <span className="line-clamp-1 min-w-0 flex-1">{session.title}</span>
        <span className="chat-history-sidebar__time shrink-0" suppressHydrationWarning>
          {formatRelativeTime(session.updatedAt)}
        </span>
      </Link>
    </li>
  );
}
