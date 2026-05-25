export type TerminalSessionGroup = "user" | "agent" | "agent-other";

export type TerminalLineKind = "prompt" | "stdout" | "stderr" | "system";

export type TerminalLine = {
  kind: TerminalLineKind;
  text: string;
};

export type TerminalSession = {
  id: string;
  group: TerminalSessionGroup;
  title: string;
  /** 侧栏展示用：Agent 命令摘要 */
  commandPreview?: string;
  cwd: string;
  lines: TerminalLine[];
  readOnly: boolean;
  /** Agent 正在占用（显示只读横幅） */
  agentUsing: boolean;
};

export const TERMINAL_GROUP_LABEL: Record<TerminalSessionGroup, string> = {
  user: "Terminals",
  agent: "Agent",
  "agent-other": "Other Agents",
};

/** 侧栏仅展示用户终端与其它 Agent */
export const TERMINAL_SIDEBAR_GROUPS: TerminalSessionGroup[] = [
  "user",
  "agent-other",
];

function line(kind: TerminalLineKind, text: string): TerminalLine {
  return { kind, text };
}

export function parseAgentSessionTitle(title: string): {
  agent: string;
  preview: string;
} {
  const match = title.match(/^(\w+)\s*\((.+)\)\s*$/);
  if (match) {
    return { agent: match[1], preview: match[2] };
  }
  return { agent: title, preview: "" };
}

export function formatUserPrompt(cwd: string): string {
  const short =
    cwd === "~/原型" || cwd === "~"
      ? "原型"
      : cwd.replace(/^~\//, "").split("/").pop() ?? cwd;
  return `(base) zhaoxiaogang@Mac-2 ${short} %`;
}

export function createSeedSessions(): TerminalSession[] {
  return [
    {
      id: "user-zsh-1",
      group: "user",
      title: "zsh",
      cwd: "~/原型",
      lines: [line("prompt", formatUserPrompt("~/原型"))],
      readOnly: false,
      agentUsing: false,
    },
    {
      id: "user-zsh-2",
      group: "user",
      title: "zsh",
      cwd: "~/原型",
      lines: [line("prompt", formatUserPrompt("~/原型"))],
      readOnly: false,
      agentUsing: false,
    },
    {
      id: "user-zsh-3",
      group: "user",
      title: "zsh",
      cwd: "~/原型/web",
      lines: [
        line("stdout", "▲ Next.js 16.2.6"),
        line("stdout", "- Local: http://localhost:3000"),
        line("prompt", formatUserPrompt("~/原型/web")),
      ],
      readOnly: false,
      agentUsing: false,
    },
    {
      id: "user-zsh-4",
      group: "user",
      title: "zsh",
      cwd: "~/原型",
      lines: [line("prompt", formatUserPrompt("~/原型"))],
      readOnly: false,
      agentUsing: false,
    },
    {
      id: "agent-active",
      group: "agent",
      title: 'Cursor (cd "…/hermes-agent")',
      commandPreview: 'cd "/Users/zhaoxiaogang/…/hermes-agent"',
      cwd: "hermes-agent",
      lines: [
        line(
          "stdout",
          'export PATH="…" && cd "/…/hermes-agent" && hermes gateway',
        ),
        line("stdout", "API server listening on http://127.0.0.1:8642"),
        line("prompt", "$ "),
      ],
      readOnly: true,
      agentUsing: true,
    },
    {
      id: "agent-other-1",
      group: "agent-other",
      title: 'Cursor (cd "…/原型")',
      commandPreview: '(cd "/Users/zhaoxiaogang/…/原型")',
      cwd: "原型",
      lines: [line("stdout", "GET / 200"), line("prompt", "$ ")],
      readOnly: true,
      agentUsing: false,
    },
    {
      id: "agent-other-2",
      group: "agent-other",
      title: 'Cursor (export PATH="…")',
      commandPreview: '(export PATH="$HOME/.local/bin:$PATH")',
      cwd: "hermes-agent",
      lines: [
        line("stdout", "hermes gateway --status"),
        line("stdout", "gateway: running"),
        line("prompt", "$ "),
      ],
      readOnly: true,
      agentUsing: false,
    },
    {
      id: "agent-other-3",
      group: "agent-other",
      title: 'Cursor (npm run dev)',
      commandPreview: '(cd "…/web" && npm run dev)',
      cwd: "web",
      lines: [
        line("stdout", "> web@0.1.0 dev"),
        line("stdout", "ready on http://localhost:3000"),
        line("prompt", "$ "),
      ],
      readOnly: true,
      agentUsing: false,
    },
    {
      id: "agent-other-4",
      group: "agent-other",
      title: 'Cursor (git status)',
      commandPreview: '(git -C "…/原型" status)',
      cwd: "原型",
      lines: [line("stdout", "On branch main"), line("prompt", "$ ")],
      readOnly: true,
      agentUsing: false,
    },
  ];
}

export function createUserSession(): TerminalSession {
  return {
    id: `user-zsh-${Date.now()}`,
    group: "user",
    title: "zsh",
    cwd: "~/原型",
    lines: [line("prompt", formatUserPrompt("~/原型"))],
    readOnly: false,
    agentUsing: false,
  };
}

/** 从工作区页签缓存恢复用户终端（原型） */
export function createUserSessionWithId(id: string): TerminalSession {
  return {
    id,
    group: "user",
    title: "zsh",
    cwd: "~/原型",
    lines: [line("prompt", formatUserPrompt("~/原型"))],
    readOnly: false,
    agentUsing: false,
  };
}

/** 从缓存的 terminal 页签重建终端会话列表 */
export function buildTerminalSessionsFromTabs(
  tabs: { kind: string; sessionId?: string }[],
): TerminalSession[] {
  const out: TerminalSession[] = [];
  for (const tab of tabs) {
    if (tab.kind !== "terminal" || !tab.sessionId) continue;
    if (tab.sessionId.startsWith("agent")) {
      out.push({
        id: tab.sessionId,
        group: tab.sessionId.startsWith("agent-other") ? "agent-other" : "agent",
        title: "Agent",
        cwd: "~/原型",
        lines: [line("system", "（已从历史会话恢复）")],
        readOnly: true,
        agentUsing: tab.sessionId === "agent-active",
      });
    } else {
      out.push(createUserSessionWithId(tab.sessionId));
    }
  }
  return out;
}

/** 原型：本地模拟命令输出（后续可换 WebSocket / PTY API） */
export function mockExecuteCommand(
  command: string,
  cwd: string,
): { lines: TerminalLine[]; cwd?: string } {
  const trimmed = command.trim();
  const nextPrompt = line("prompt", formatUserPrompt(cwd));

  if (!trimmed) return { lines: [] };

  if (trimmed === "clear") {
    return { lines: [nextPrompt] };
  }

  if (trimmed === "help") {
    return {
      lines: [
        line("stdout", "可用命令（原型）: help, clear, pwd, hermes gateway"),
        nextPrompt,
      ],
    };
  }

  if (trimmed === "pwd") {
    return {
      lines: [line("stdout", cwd), nextPrompt],
    };
  }

  if (trimmed.startsWith("cd ")) {
    const target = trimmed.slice(3).trim() || "~";
    const newCwd = target.startsWith("~") ? target : `~/${target}`;
    return {
      cwd: newCwd,
      lines: [line("prompt", formatUserPrompt(newCwd))],
    };
  }

  if (trimmed.includes("hermes gateway")) {
    return {
      lines: [
        line("stdout", "Starting hermes gateway…"),
        line("stdout", "API server listening on http://127.0.0.1:8642"),
        line("stdout", "platform: api_server · model: hermes-agent"),
        nextPrompt,
      ],
    };
  }

  if (trimmed.includes("hermes")) {
    return {
      lines: [
        line("stdout", `（原型）已接收: ${trimmed}`),
        line("stdout", "提示: 真实环境由 Agent 在 Agent 终端中执行"),
        nextPrompt,
      ],
    };
  }

  return {
    lines: [
      line("stdout", `zsh: command not found: ${trimmed.split(/\s+/)[0]}`),
      nextPrompt,
    ],
  };
}
