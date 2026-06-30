"use client";

import {
  ChevronDown,
  Folder,
  FolderPlus,
  Search,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createLocalBoundProject } from "@/lib/create-local-project";
import { buildLocalFolderPick } from "@/lib/pick-local-folder";
import { useResearchProjects } from "@/contexts/ResearchProjectsContext";
import {
  addCustomResearchProject,
  isUsingLocalProject,
  type ResearchProject,
} from "@/lib/research-projects";
import type { DesktopPickAndImportResult } from "@/types/electron";

type BindDraft = { name: string; baseDir: string };

export function ProjectWorkPicker({
  projectId,
  onSelectProject,
  onCreateLocalProject,
}: {
  projectId: string;
  onSelectProject: (project: ResearchProject | null) => void;
  onCreateLocalProject?: (project: ResearchProject) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bindDraft, setBindDraft] = useState<BindDraft | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { localBoundProjects, getProject, refresh } = useResearchProjects();

  const usingProject = isUsingLocalProject(projectId);
  const projects = localBoundProjects.filter(
    (p) => p.bindingSource !== "platform_default",
  );
  const current = getProject(projectId) ?? projects.find((p) => p.id === projectId);
  const currentDisplay =
    current?.bindingSource === "platform_default"
      ? current.pathSummary
      : current?.name;

  const filtered = projects.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.pathSummary.toLowerCase().includes(q)
    );
  });

  const noProjectSelected = !usingProject;

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setBindDraft(null);
        setBindError(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
    setBindDraft(null);
    setBindError(null);
  };

  const startAddProject = useCallback(async () => {
    setBindError(null);
    const api = window.electronAPI;
    if (api?.isDesktop && api.pickAndImportFolder) {
      setCreating(true);
      try {
        const result: DesktopPickAndImportResult =
          await api.pickAndImportFolder();
        if (!result.ok) {
          if (result.canceled) return;
          setBindError(result.message ?? "未能导入文件夹");
          return;
        }
        const project: ResearchProject = {
          id: result.projectId,
          kind: "local_bound",
          name: result.name ?? "未命名项目",
          pathSummary: result.pathSummary ?? "",
        };
        addCustomResearchProject(project);
        refresh();
        onCreateLocalProject?.(project);
        onSelectProject(project);
        closeMenu();
      } catch (err) {
        setBindError(err instanceof Error ? err.message : "导入失败");
      } finally {
        setCreating(false);
      }
      return;
    }
    setBindDraft({ name: "", baseDir: "~/Projects/" });
  }, [onCreateLocalProject, onSelectProject, refresh]);

  const confirmBind = useCallback(async () => {
    const pick = buildLocalFolderPick(bindDraft?.name ?? "", bindDraft?.baseDir ?? "");
    if (!pick) {
      setBindError("请填写项目名称与文件夹路径");
      return;
    }
    setCreating(true);
    setBindError(null);
    try {
      const project = await createLocalBoundProject(pick);
      refresh();
      onCreateLocalProject?.(project);
      onSelectProject(project);
      closeMenu();
    } catch (err) {
      setBindError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }, [bindDraft, onCreateLocalProject, onSelectProject, refresh]);

  return (
    <div className="project-work-picker" ref={rootRef}>
      <button
        type="button"
        className={`project-work-picker__trigger ${usingProject ? "project-work-picker__trigger--active" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={usingProject ? `当前工作文件夹：${currentDisplay}` : "选择工作文件夹"}
        onClick={() => setOpen((o) => !o)}
      >
        {usingProject && current ? (
          <>
            <Folder
              className="h-4 w-4 shrink-0 text-[var(--fg-secondary)]"
              strokeWidth={1.75}
            />
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {currentDisplay}
            </span>
          </>
        ) : (
          <>
            <span className="project-work-picker__icon" aria-hidden>
              <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">
              选择工作文件夹
            </span>
          </>
        )}
        <ChevronDown
          className={`control-picker__chevron shrink-0 ${open ? "control-picker__chevron--open" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div className="project-work-picker__menu">
          {bindDraft ? (
            <div className="project-work-picker__bind px-3 py-3">
              <p className="mb-2 text-xs text-[var(--fg-secondary)]">
                填写本机工作文件夹路径（支持 <code className="font-mono">~/</code>
                ）。可在 Finder 中右键文件夹 →「显示简介」或复制路径后粘贴。
              </p>
              <label className="mb-2 block text-xs text-[var(--fg-tertiary)]">
                项目名称
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                  value={bindDraft.name}
                  onChange={(e) =>
                    setBindDraft((d) =>
                      d ? { ...d, name: e.target.value } : d,
                    )
                  }
                />
              </label>
              <label className="mb-2 block text-xs text-[var(--fg-tertiary)]">
                文件夹路径
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-mono text-sm"
                  placeholder="~/Projects/my-app"
                  value={bindDraft.baseDir}
                  onChange={(e) =>
                    setBindDraft((d) =>
                      d ? { ...d, baseDir: e.target.value } : d,
                    )
                  }
                />
              </label>
              {bindError && (
                <p className="mb-2 text-xs text-[var(--danger)]">{bindError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1 text-sm"
                  disabled={creating}
                  onClick={() => {
                    setBindDraft(null);
                    setBindError(null);
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 text-sm"
                  disabled={creating}
                  onClick={() => void confirmBind()}
                >
                  {creating ? "绑定中…" : "确认绑定"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="project-work-picker__search">
                <Search
                  className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]"
                  strokeWidth={1.75}
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索文件夹"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-tertiary)]"
                />
              </div>
              <ul className="project-work-picker__list" role="listbox">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[var(--fg-tertiary)]">
                    没有匹配的项目
                  </li>
                ) : (
                  filtered.map((p) => {
                    const selected = p.id === projectId;
                    return (
                      <li key={p.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`project-work-picker__item ${selected ? "project-work-picker__item--selected" : ""}`}
                          onClick={() => {
                            onSelectProject(p);
                            closeMenu();
                          }}
                        >
                          <Folder
                            className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate">{p.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--fg-tertiary)]">
                              {p.pathSummary}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              {bindError && (
                <p className="px-3 py-2 text-xs text-[var(--danger)]">{bindError}</p>
              )}
              <div className="project-work-picker__footer">
                <button
                  type="button"
                  className={`project-work-picker__item w-full ${noProjectSelected ? "project-work-picker__item--selected" : ""}`}
                  onClick={() => {
                    onSelectProject(null);
                    closeMenu();
                  }}
                >
                  <XCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>不选择项目文件夹</span>
                </button>
                <button
                  type="button"
                  className="project-work-picker__item w-full"
                  onClick={() => void startAddProject()}
                >
                  <FolderPlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>添加文件夹</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
