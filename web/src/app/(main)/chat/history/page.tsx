import Link from "next/link";
import { Folder } from "lucide-react";
import { ChatSessionStatusIndicator } from "@/components/chat/ChatSessionStatusIndicator";
import {
  formatRelativeTime,
  getGroupedChatHistory,
  getSessionIndicator,
  type ChatSessionRecord,
} from "@/lib/chat-history";

export default function ChatHistoryPage() {
  const { projectGroups, unassigned } = getGroupedChatHistory();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <h1 className="text-xl font-semibold">历史会话</h1>
      <p className="mt-1 text-sm text-[var(--fg-secondary)]">
        按研究项目分组；圆点表示执行与阅读状态（灰=已读、蓝=未读、橙=待确认、转圈=执行中）
      </p>

      <div className="mt-6 space-y-6">
        {projectGroups.map((group) => (
          <section key={group.projectId}>
            <h2 className="text-overline mb-2 flex items-center gap-1.5">
              <Folder className="h-4 w-4" strokeWidth={1.75} />
              {group.label}
            </h2>
            <SessionTable sessions={group.sessions} />
          </section>
        ))}
        {unassigned.length > 0 && (
          <section>
            <h2 className="text-overline mb-2 text-[var(--fg-tertiary)]">无项目</h2>
            <SessionTable sessions={unassigned} />
          </section>
        )}
      </div>
    </div>
  );
}

function SessionTable({ sessions }: { sessions: ChatSessionRecord[] }) {
  return (
    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
      {sessions.map((item) => (
        <li key={item.id}>
          <Link
            href={`/chat/${item.id}`}
            className="flex items-center gap-3 px-4 py-4 hover:bg-[var(--sidebar-hover)]"
          >
            <ChatSessionStatusIndicator
              indicator={getSessionIndicator(item)}
            />
            <span className="min-w-0 flex-1 text-sm font-medium">{item.title}</span>
            <span className="shrink-0 text-xs text-[var(--muted)]">
              {formatRelativeTime(item.updatedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
