import type { LucideIcon } from "lucide-react";
import {
  Languages,
  Library,
  MessageSquare,
  Mic,
  PenLine,
  Presentation,
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
    id: "translate",
    label: "翻译",
    href: "/translate",
    icon: Languages,
    subNav: [
      {
        label: "翻译",
        href: "/translate/new",
        description: "对话式翻译，文档/文本/润色统一入口",
      },
    ],
  },
  {
    id: "meeting",
    label: "会议",
    href: "/meeting",
    icon: Mic,
    subNav: [
      { label: "新建纪要", href: "/meeting/new" },
      { label: "纪要历史", href: "/meeting/history" },
    ],
  },
  {
    id: "knowledge",
    label: "知识库",
    href: "/knowledge",
    icon: Library,
    subNav: [
      { label: "我的文档", href: "/knowledge/documents" },
      { label: "知识库问答", href: "/knowledge/qa" },
      { label: "多信源分析", href: "/knowledge/sources" },
    ],
  },
];

import {
  normalizeChatMode as normalizeChatModeCore,
  type ChatModeId,
} from "@jlc/runtime-core/chat-mode";

export { type ChatModeId };

export const CHAT_MODES = [
  { id: "fast", label: "快速", description: "优先响应速度" },
  { id: "deep", label: "深度", description: "分步推理或完整研究，由助手按问题复杂度决策" },
] as const satisfies ReadonlyArray<{ id: ChatModeId; label: string; description: string }>;

/** API / 历史会话：`research` → `deep`（PRD v3.2） */
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
