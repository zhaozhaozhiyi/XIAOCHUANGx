"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Folder, MoreHorizontal, Plus } from "lucide-react";
import { ChatSessionStatusIndicator } from "./ChatSessionStatusIndicator";
import {
  formatRelativeTime,
  getSessionIndicator,
  PLATFORM_DEFAULT_GROUP_ID,
  removeChatSession,
  renameChatSession,
  SIDEBAR_SESSIONS_INITIAL,
  SIDEBAR_SESSIONS_MORE_STEP,
  type ChatSessionRecord,
} from "@/lib/chat-history";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useResearchProjects } from "@/contexts/ResearchProjectsContext";
import {
  type ChatSurfaceModuleId,
  getChatSurfaceFromPathname,
  MODULE_CHAT_SURFACES,
  sessionPath,
} from "@/lib/module-chat-config";
import {
  NO_PROJECT_ID,
  PLATFORM_DEFAULT_GROUP_LABEL,
  hideResearchProject,
} from "@/lib/research-projects";

const COLLAPSE_STORAGE_KEY = "jlc-sidebar-project-collapsed";
const HISTORY_MODULE_LABEL: Record<ChatSurfaceModuleId, string | null> = {
  chat: null,
  writing: "写作",
  ppt: "PPT",
  "3d": "3D",
  video: "视频",
  simulation: "推演",
};

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
  const surface = getChatSurfaceFromPathname(pathname);
  const { projectGroups, unassigned } = useChatHistory();
  const { getProject, refresh: refreshProjects } = useResearchProjects();

  const resolvedGroups = projectGroups.map((group) => ({
    ...group,
    label:
      group.projectId === PLATFORM_DEFAULT_GROUP_ID
        ? PLATFORM_DEFAULT_GROUP_LABEL
        : (getProject(group.projectId)?.name ?? group.label),
  }));
  const activeId =
    pathname.match(/^\/chat\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/writing\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/ppt\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/3d\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/video\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/simulation\/([^/]+)$/)?.[1];
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => readCollapsedGroups(),
  );
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
      if (
        projectId === NO_PROJECT_ID ||
        projectId === PLATFORM_DEFAULT_GROUP_ID
      ) {
        router.push(surface.newSessionHref);
        return;
      }
      router.push(
        `${surface.newSessionHref}?project=${encodeURIComponent(projectId)}`,
      );
    },
    [router, surface.newSessionHref],
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

  const handleProjectRemoved = useCallback(
    (projectId: string) => {
      refreshProjects();
      const removedGroup = resolvedGroups.find((group) => group.projectId === projectId);
      if (removedGroup?.sessions.some((session) => session.id === activeId)) {
        router.push(surface.newSessionHref);
      }
    },
    [activeId, refreshProjects, resolvedGroups, router, surface.newSessionHref],
  );

  return (
    <div className="chat-history-sidebar">
      {resolvedGroups.map((group) => {
        const isDefaultFolderGroup =
          group.projectId === PLATFORM_DEFAULT_GROUP_ID;
        return (
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
            onProjectRemoved={handleProjectRemoved}
            visibleCount={getVisibleCount(group.projectId, group.sessions.length)}
            onLoadMore={() => loadMore(group.projectId, group.sessions.length)}
            last={isDefaultFolderGroup && resolvedGroups.length > 1}
          />
        );
      })}

      {unassigned.length > 0 && (
        <HistoryGroupSection
          groupKey="__unassigned__"
          label="默认工作文件夹（XIAOCHUANG）"
          projectId={NO_PROJECT_ID}
          muted
          sessions={unassigned}
          activeId={activeId}
          collapsed={!!collapsedGroups.__unassigned__}
          onToggleCollapsed={() => toggleGroupCollapsed("__unassigned__")}
          onNewChat={() => startChatInProject(NO_PROJECT_ID)}
          onProjectRemoved={handleProjectRemoved}
          visibleCount={getVisibleCount("__unassigned__", unassigned.length)}
          onLoadMore={() => loadMore("__unassigned__", unassigned.length)}
          last
        />
      )}
    </div>
  );
}

function HistoryGroupSection({
  groupKey,
  label,
  sessions,
  activeId,
  visibleCount,
  onLoadMore,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onProjectRemoved,
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
  onProjectRemoved: (projectId: string) => void;
  muted?: boolean;
  last?: boolean;
}) {
  const visible = sessions.slice(0, visibleCount);
  const hasMore = sessions.length > visibleCount;
  const projectMenuEnabled = !muted && groupKey !== PLATFORM_DEFAULT_GROUP_ID;
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!projectRef.current?.contains(event.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjectMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [projectMenuOpen]);

  const openProjectFolder = async () => {
    setProjectMenuOpen(false);
    if (!window.electronAPI?.openProjectFolder) {
      window.alert("当前环境不支持打开本机文件夹。");
      return;
    }
    const result = await window.electronAPI.openProjectFolder({
      projectId: groupKey,
    });
    if (!result.ok) {
      window.alert(result.message ?? "打开文件夹失败");
    }
  };

  const removeProject = () => {
    if (!window.confirm(`从左侧项目列表移除「${label}」？`)) return;
    hideResearchProject(groupKey);
    onProjectRemoved(groupKey);
    setProjectMenuOpen(false);
  };

  return (
    <section
      className={`chat-history-sidebar__section ${last ? "chat-history-sidebar__section--last" : ""}`}
    >
      <div
        className={`chat-history-sidebar__project ${muted ? "chat-history-sidebar__project--muted" : ""}`}
        ref={projectRef}
        onContextMenu={(event) => {
          if (!projectMenuEnabled) return;
          event.preventDefault();
          setProjectMenuOpen(true);
        }}
      >
        <div className="chat-history-sidebar__project-text">
          <button
            type="button"
            className="chat-history-sidebar__project-label"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `展开「${label}」` : `收起「${label}」`}
          >
            <Folder
              className="chat-history-sidebar__project-icon h-3.5 w-3.5 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
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
          {projectMenuEnabled ? (
            <button
              type="button"
              className="chat-history-sidebar__project-more"
              aria-label={`更多项目操作：${label}`}
              aria-expanded={projectMenuOpen}
              onClick={() => setProjectMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {projectMenuOpen ? (
          <div className="chat-history-sidebar__project-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => void openProjectFolder()}
            >
              打开文件夹
            </button>
            <button type="button" role="menuitem" onClick={removeProject}>
              移除
            </button>
          </div>
        ) : null}
      </div>
      {!collapsed && (
        <>
          <ul className="chat-history-sidebar__list">
            {visible.map((item) => (
              <ChatHistoryItem
                key={item.id}
                session={item}
                active={activeId === item.id}
                href={sessionPath(
                  MODULE_CHAT_SURFACES[item.surfaceModuleId ?? "chat"],
                  item.id,
                )}
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
  href,
}: {
  session: ChatSessionRecord;
  active: boolean;
  href: string;
}) {
  const router = useRouter();
  const indicator = getSessionIndicator(session, { isActive: active });
  const moduleLabel = HISTORY_MODULE_LABEL[session.surfaceModuleId ?? "chat"];
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"down" | "up">("down");
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOnScroll = () => setMenuOpen(false);
    const scrollParent = itemRef.current?.closest(".sidebar-history-scroll");
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    scrollParent?.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      scrollParent?.removeEventListener("scroll", closeOnScroll);
    };
  }, [menuOpen]);

  const openMenu = useCallback(() => {
    const item = itemRef.current;
    if (item) {
      const itemRect = item.getBoundingClientRect();
      const scrollParent = item.closest(".sidebar-history-scroll");
      const boundaryBottom =
        scrollParent?.getBoundingClientRect().bottom ?? window.innerHeight;
      setMenuPlacement(boundaryBottom - itemRect.bottom < 132 ? "up" : "down");
    }
    setMenuOpen(true);
  }, []);

  const rename = useCallback(() => {
    const nextTitle = window.prompt("重命名对话", session.title);
    if (nextTitle === null) return;
    renameChatSession(session.id, nextTitle);
    setMenuOpen(false);
  }, [session.id, session.title]);

  const openFolder = useCallback(async () => {
    setMenuOpen(false);
    if (
      session.projectId === NO_PROJECT_ID ||
      session.projectId === PLATFORM_DEFAULT_GROUP_ID
    ) {
      window.alert("这个对话没有绑定到可打开的项目文件夹。");
      return;
    }
    if (!window.electronAPI?.openProjectFolder) {
      window.alert("当前环境不支持打开本机文件夹。");
      return;
    }
    const result = await window.electronAPI.openProjectFolder({
      projectId: session.projectId,
    });
    if (!result.ok) {
      window.alert(result.message ?? "打开文件夹失败");
    }
  }, [session.projectId]);

  const remove = useCallback(() => {
    if (!window.confirm(`从侧边栏移除「${session.title}」？`)) return;
    removeChatSession(session.id);
    setMenuOpen(false);
    if (active) {
      const surface = MODULE_CHAT_SURFACES[session.surfaceModuleId ?? "chat"];
      router.push(surface.newSessionHref);
    }
  }, [active, router, session.id, session.surfaceModuleId, session.title]);

  return (
    <li className="chat-history-sidebar__item-wrap" ref={itemRef}>
      <Link
        href={href}
        className={`chat-history-sidebar__item ${active ? "chat-history-sidebar__item--active" : ""}`}
        aria-current={active ? "page" : undefined}
        title={session.title}
      >
        <ChatSessionStatusIndicator indicator={indicator} />
        <span className="line-clamp-1 min-w-0 flex-1">{session.title}</span>
        {moduleLabel ? (
          <span className="chat-history-sidebar__module shrink-0">
            {moduleLabel}
          </span>
        ) : null}
        <span className="chat-history-sidebar__time shrink-0" suppressHydrationWarning>
          {formatRelativeTime(session.updatedAt)}
        </span>
      </Link>
      <button
        type="button"
        className="chat-history-sidebar__item-more"
        aria-label={`更多操作：${session.title}`}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (menuOpen) {
            setMenuOpen(false);
          } else {
            openMenu();
          }
        }}
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {menuOpen ? (
        <div
          className={`chat-history-sidebar__item-menu ${
            menuPlacement === "up" ? "chat-history-sidebar__item-menu--up" : ""
          }`}
          role="menu"
        >
          <button type="button" role="menuitem" onClick={rename}>
            重命名
          </button>
          <button type="button" role="menuitem" onClick={() => void openFolder()}>
            打开文件夹
          </button>
          <button type="button" role="menuitem" onClick={remove}>
            移除
          </button>
        </div>
      ) : null}
    </li>
  );
}
