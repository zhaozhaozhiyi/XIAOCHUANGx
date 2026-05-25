import type { ReactNode } from "react";
import { InlinePathText } from "@/components/chat/parts/InlinePathText";

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "image"; alt: string; src: string }
  | { kind: "url"; href: string }
  | { kind: "math"; value: string };

const PATTERNS: {
  re: RegExp;
  map: (m: RegExpExecArray) => InlineToken;
}[] = [
  {
    re: /!\[([^\]]*)\]\(([^)]+)\)/,
    map: (m) => ({ kind: "image", alt: m[1] ?? "", src: m[2]! }),
  },
  {
    re: /\[([^\]]+)\]\(([^)]+)\)/,
    map: (m) => ({ kind: "link", text: m[1]!, href: m[2]! }),
  },
  {
    re: /\*\*([^*]+)\*\*/,
    map: (m) => ({ kind: "bold", value: m[1]! }),
  },
  {
    re: /`([^`]+)`/,
    map: (m) => ({ kind: "code", value: m[1]! }),
  },
  {
    re: /\$([^$\n]+)\$/,
    map: (m) => ({ kind: "math", value: m[1]!.trim() }),
  },
  {
    re: /(https?:\/\/[^\s<>)]+[^\s<>).,;!?])/,
    map: (m) => ({ kind: "url", href: m[1]! }),
  },
];

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = text;

  while (rest.length > 0) {
    let best: { index: number; len: number; token: InlineToken } | null =
      null;

    for (const { re, map } of PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(rest);
      if (!m) continue;
      if (best === null || m.index < best.index) {
        best = { index: m.index, len: m[0].length, token: map(m) };
      }
    }

    if (!best) {
      tokens.push({ kind: "text", value: rest });
      break;
    }

    if (best.index > 0) {
      tokens.push({ kind: "text", value: rest.slice(0, best.index) });
    }
    tokens.push(best.token);
    rest = rest.slice(best.index + best.len);
  }

  return tokens;
}

export function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
): ReactNode[] {
  return tokenizeInline(text).map((tok, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (tok.kind) {
      case "text":
        return <InlinePathText key={key} text={tok.value} />;
      case "bold":
        return (
          <strong key={key} className="font-medium text-[var(--fg)]">
            {tok.value}
          </strong>
        );
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono text-[13px] text-[var(--fg)]"
          >
            {tok.value}
          </code>
        );
      case "math":
        return (
          <span
            key={key}
            className="mx-0.5 rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--fg)]"
            title="公式"
          >
            {tok.value}
          </span>
        );
      case "link":
        return (
          <a
            key={key}
            href={tok.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)] break-all"
          >
            {tok.text}
          </a>
        );
      case "url":
        return (
          <a
            key={key}
            href={tok.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)] break-all"
          >
            {tok.href}
          </a>
        );
      case "image":
        return (
          <img
            key={key}
            src={tok.src}
            alt={tok.alt}
            className="my-2 max-h-72 max-w-full rounded-lg border border-[var(--border)] object-contain"
            loading="lazy"
          />
        );
      default:
        return null;
    }
  });
}
