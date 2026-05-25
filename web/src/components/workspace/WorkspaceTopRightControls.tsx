"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { WorkspaceAddTabMenu } from "./WorkspaceAddTabMenu";
import { useWorkspace } from "./WorkspaceContext";

/** 与顶栏 h-14 垂直居中：top 12px、right 8px（视口固定） */
const FIXED_GROUP_CLASS = "fixed top-3 right-2 z-50 flex items-center gap-0.5";

function WorkspaceToggleButtonInner() {
  const { open, toggleOpen } = useWorkspace();

  return (
    <button
      type="button"
      onClick={toggleOpen}
      className="btn-icon"
      aria-label={open ? "收起工作区" : "展开工作区"}
      title={open ? "收起工作区" : "展开工作区"}
    >
      {open ? (
        <PanelRightClose className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}

/** 视口右上角固定：新建页签 + 展开/收起工作区（与改版前一致） */
export function WorkspaceTopRightControls() {
  const { open } = useWorkspace();

  return (
    <div className={FIXED_GROUP_CLASS}>
      {open && <WorkspaceAddTabMenu />}
      <WorkspaceToggleButtonInner />
    </div>
  );
}

/** 工作区页签栏右侧为固定按钮预留宽度（两个 btn-icon + gap） */
export const WORKSPACE_TAB_BAR_RIGHT_PADDING = "pr-[4.75rem]";
