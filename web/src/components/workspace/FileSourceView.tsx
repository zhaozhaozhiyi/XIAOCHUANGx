"use client";

import { useEffect, useRef } from "react";

type TokenType =
  | "plain"
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "punctuation"
  | "tag"
  | "attr";

type Rule = {
  regex: RegExp;
  type: Exclude<TokenType, "plain">;
};

type CodeLanguage =
  | "markdown"
  | "json"
  | "sql"
  | "typescript"
  | "javascript"
  | "yaml"
  | "shell"
  | "css"
  | "toml"
  | "text"
  | "pptx"
  | "html"
  | "python";

type Token = { text: string; type: TokenType };

function pushToken(tokens: Token[], text: string, type: TokenType): void {
  if (!text) return;
  const prev = tokens[tokens.length - 1];
  if (prev && prev.type === type) {
    prev.text += text;
    return;
  }
  tokens.push({ text, type });
}

function tokenizeWithRules(line: string, rules: Rule[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    let matched = false;
    for (const rule of rules) {
      rule.regex.lastIndex = i;
      const m = rule.regex.exec(line);
      if (!m || m.index !== i) continue;
      pushToken(tokens, m[0], rule.type);
      i = rule.regex.lastIndex;
      matched = true;
      break;
    }
    if (!matched) {
      pushToken(tokens, line[i] ?? "", "plain");
      i += 1;
    }
  }
  return tokens;
}

function tokenizeByLanguage(
  line: string,
  language: CodeLanguage | undefined,
): Token[] {
  if (!line) return [{ text: " ", type: "plain" }];

  if (language === "json") {
    return tokenizeWithRules(line, [
      { regex: /"(?:\\.|[^"\\])*"(?=\s*:)/gy, type: "attr" },
      { regex: /"(?:\\.|[^"\\])*"/gy, type: "string" },
      { regex: /\b(?:true|false|null)\b/gy, type: "keyword" },
      { regex: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/gy, type: "number" },
      { regex: /[{}\[\],:]/gy, type: "punctuation" },
    ]);
  }

  if (language === "html") {
    return tokenizeWithRules(line, [
      { regex: /<!--.*?-->/gy, type: "comment" },
      { regex: /<\/?[A-Za-z][\w:-]*/gy, type: "tag" },
      { regex: /\b[A-Za-z_:][\w:.-]*(?=\=)/gy, type: "attr" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\/?>/gy, type: "tag" },
      { regex: /[=]/gy, type: "operator" },
    ]);
  }

  if (language === "python") {
    return tokenizeWithRules(line, [
      { regex: /#.*/gy, type: "comment" },
      {
        regex:
          /\b(?:def|class|if|elif|else|for|while|try|except|finally|with|as|return|yield|import|from|pass|break|continue|in|is|not|and|or|lambda|global|nonlocal|assert|raise|True|False|None)\b/gy,
        type: "keyword",
      },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=+\-*/%<>!]+/gy, type: "operator" },
    ]);
  }

  if (language === "typescript") {
    return tokenizeWithRules(line, [
      { regex: /\/\/.*/gy, type: "comment" },
      {
        regex:
          /\b(?:const|let|var|function|class|interface|type|enum|extends|implements|if|else|for|while|switch|case|default|return|import|from|export|new|try|catch|finally|throw|await|async|true|false|null|undefined)\b/gy,
        type: "keyword",
      },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gy, type: "string" },
      { regex: /\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=+\-*/%<>!&|?:]+/gy, type: "operator" },
    ]);
  }

  if (language === "javascript") {
    return tokenizeWithRules(line, [
      { regex: /\/\/.*/gy, type: "comment" },
      {
        regex:
          /\b(?:const|let|var|function|class|if|else|for|while|switch|case|default|return|import|from|export|new|try|catch|finally|throw|await|async|true|false|null|undefined)\b/gy,
        type: "keyword",
      },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gy, type: "string" },
      { regex: /\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=+\-*/%<>!&|?:]+/gy, type: "operator" },
    ]);
  }

  if (language === "yaml") {
    return tokenizeWithRules(line, [
      { regex: /#.*/gy, type: "comment" },
      { regex: /\b[A-Za-z_][\w-]*(?=\s*:)/gy, type: "attr" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\b(?:true|false|null|yes|no|on|off)\b/gy, type: "keyword" },
      { regex: /-?\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[:\-{}\[\],]/gy, type: "punctuation" },
    ]);
  }

  if (language === "shell") {
    return tokenizeWithRules(line, [
      { regex: /#.*/gy, type: "comment" },
      {
        regex:
          /\b(?:if|then|else|elif|fi|for|in|do|done|while|case|esac|function|local|export|readonly|unset|return|break|continue|source)\b/gy,
        type: "keyword",
      },
      { regex: /\$(?:\{[^}]+\}|[A-Za-z_]\w*|\d+|[@*#?$!_-])/gy, type: "attr" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=+\-*/%<>|&!]+/gy, type: "operator" },
    ]);
  }

  if (language === "css") {
    return tokenizeWithRules(line, [
      { regex: /\/\*.*?\*\//gy, type: "comment" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      {
        regex:
          /\b(?:@media|@supports|@keyframes|@import|@layer|@font-face|@mixin|@include|@extend|@if|@else|@for|@each)\b/gy,
        type: "keyword",
      },
      { regex: /\.[A-Za-z_-][\w-]*|#[A-Fa-f0-9]{3,8}\b|#[A-Za-z_-][\w-]*/gy, type: "tag" },
      { regex: /\b[A-Za-z-]+(?=\s*:)/gy, type: "attr" },
      { regex: /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms)?\b/gy, type: "number" },
      { regex: /[{}():;,]/gy, type: "punctuation" },
    ]);
  }

  if (language === "toml") {
    return tokenizeWithRules(line, [
      { regex: /#.*/gy, type: "comment" },
      { regex: /\[[^\]]+\]/gy, type: "tag" },
      { regex: /\b[A-Za-z_][\w.-]*(?=\s*=)/gy, type: "attr" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\b(?:true|false)\b/gy, type: "keyword" },
      { regex: /-?\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=,]/gy, type: "operator" },
    ]);
  }

  if (language === "sql") {
    return tokenizeWithRules(line, [
      { regex: /--.*/gy, type: "comment" },
      {
        regex:
          /\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|AS|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|VIEW|DISTINCT|COUNT|SUM|AVG|MIN|MAX)\b/gy,
        type: "keyword",
      },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gy, type: "string" },
      { regex: /\b\d+(?:\.\d+)?\b/gy, type: "number" },
      { regex: /[=+\-*/%<>!]+/gy, type: "operator" },
    ]);
  }

  return [{ text: line, type: "plain" }];
}

export function FileSourceView({
  content,
  language,
  highlightLine,
  highlightEndLine,
  onRevealed,
}: {
  content: string;
  language?: CodeLanguage;
  highlightLine?: number;
  highlightEndLine?: number;
  onRevealed?: () => void;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const lines = content.split("\n");
  const start = highlightLine ?? 0;
  const end = highlightEndLine ?? start;

  useEffect(() => {
    if (!highlightLine || !lineRef.current) return;
    lineRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    onRevealed?.();
  }, [content, highlightLine, onRevealed]);

  return (
    <pre className="font-mono text-[13px] leading-relaxed text-[var(--fg)]">
      {lines.map((line, i) => {
        const n = i + 1;
        const inRange =
          highlightLine != null && n >= start && n <= (end || start);
        return (
          <div
            key={i}
            ref={n === highlightLine ? lineRef : undefined}
            className={`flex gap-3 px-1 ${inRange ? "bg-[var(--accent-muted)]" : ""}`}
          >
            <span className="w-8 shrink-0 select-none text-right text-[11px] text-[var(--fg-tertiary)]">
              {n}
            </span>
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {tokenizeByLanguage(line, language).map((token, ti) => (
                <span
                  key={ti}
                  className={
                    token.type === "plain"
                      ? undefined
                      : `workspace-code-token workspace-code-token--${token.type}`
                  }
                >
                  {token.text}
                </span>
              ))}
            </code>
          </div>
        );
      })}
    </pre>
  );
}
