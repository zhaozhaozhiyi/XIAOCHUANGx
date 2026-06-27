"use client";

import { FileNavigationBar } from "./FileNavigationBar";
import { FileTree } from "./FileTree";
import { FileTreePaneResizeHandle } from "./FileTreePaneResizeHandle";
import { FileViewer } from "./FileViewer";
import { useWorkspace } from "./WorkspaceContext";

export function FilesWorkspacePane() {
  const { treePaneOpen, treePaneWidth } = useWorkspace();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileNavigationBar />

      <div
        id="workspace-files-split"
        className="flex min-h-0 flex-1 overflow-hidden"
      >
        {treePaneOpen && (
          <>
            <aside
              style={{ width: treePaneWidth }}
              className="flex min-h-0 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]"
              aria-label="文件目录"
            >
              <FileTree />
            </aside>
            <FileTreePaneResizeHandle />
          </>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-elevated)]">
          <FileViewer />
        </div>
      </div>
    </div>
  );
}
