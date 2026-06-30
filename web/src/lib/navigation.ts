import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  MessageSquare,
  PenLine,
  Presentation,
  Box,
  GitBranch,
} from "lucide-react";

export type SubNavItem = {
  label: string;
  href: string;
  description?: string;
};

export type NavModule = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  subNav: SubNavItem[];
};

export const NAV_MODULES: NavModule[] = [
  {
    id: "chat",
    label: "对话",
    href: "/chat",
    icon: MessageSquare,
    subNav: [
      { label: "新对话", href: "/chat", description: "发起智能问答" },
      { label: "历史会话", href: "/chat/history", description: "查看与继续历史对话" },
    ],
  },
  {
    id: "writing",
    label: "写作",
    href: "/writing",
    icon: PenLine,
    subNav: [
      {
        label: "写作",
        href: "/writing/new",
        description: "对话式写作，产出 Markdown 文稿",
      },
    ],
  },
  {
    id: "ppt",
    label: "PPT",
    href: "/ppt",
    icon: Presentation,
    subNav: [
      {
        label: "PPT",
        href: "/ppt/new",
        description: "对话式生成演示文稿",
      },
    ],
  },
  {
    id: "3d",
    label: "3D绘图",
    href: "/3d",
    icon: Box,
    subNav: [
      {
        label: "3D绘图",
        href: "/3d/new",
        description: "参数化工业几何生成、预览与导出",
      },
    ],
  },
  {
    id: "video",
    label: "视频",
    href: "/video",
    icon: Clapperboard,
    badge: "0.x",
    subNav: [
      {
        label: "视频",
        href: "/video/new",
        description: "对话式生成 Remotion 视频项目与 MP4",
      },
    ],
  },
  {
    id: "simulation",
    label: "推演",
    href: "/simulation",
    icon: GitBranch,
    badge: "Beta",
    subNav: [
      {
        label: "推演",
        href: "/simulation/new",
        description: "多智能体沙盘推演与决策报告",
      },
    ],
  },
];

import {
  normalizeChatMode as normalizeChatModeCore,
  type ChatModeId,
} from "@jlc/runtime-core/chat-mode";

export { type ChatModeId };

export const CHAT_MODES = [
  { id: "auto", label: "自动", description: "由助手按问题复杂度判断回答深度" },
  { id: "fast", label: "快速", description: "优先响应速度" },
  { id: "deep", label: "深度", description: "分步推理或完整研究，由助手按问题复杂度决策" },
] as const satisfies ReadonlyArray<{ id: ChatModeId; label: string; description: string }>;

/** API / 历史会话：`research` → `deep`；主路径默认 `auto` */
export function normalizeChatMode(mode: string): ChatModeId | null {
  return normalizeChatModeCore(mode);
}

export { MOCK_CHAT_HISTORY } from "@/lib/chat-history";

export function getModuleByPath(pathname: string): NavModule | undefined {
  return NAV_MODULES.find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );
}

export function getSubNavItem(pathname: string): SubNavItem | undefined {
  for (const mod of NAV_MODULES) {
    const item = mod.subNav.find(
      (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
    );
    if (item) return item;
  }
  return undefined;
}
