"use client";

import { PanelLeft } from "lucide-react";

/** 与侧栏顶栏、对话顶栏一致 */
export const MAIN_TOP_BAR_CLASS = "h-14";

type SidebarExpandButtonProps = {
  onClick: () => void;
};

/** 侧栏收起时显示在对话区顶栏左侧，垂直居中 */
export function SidebarExpandButton({ onClick }: SidebarExpandButtonProps) {
  return (
    <div
      className={`absolute left-0 top-0 z-40 flex ${MAIN_TOP_BAR_CLASS} w-14 items-center justify-center`}
    >
      <button
        type="button"
        onClick={onClick}
        className="btn-icon"
        aria-label="展开侧栏"
        title="展开侧栏"
      >
        <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
