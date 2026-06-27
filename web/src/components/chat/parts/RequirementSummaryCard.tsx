"use client";

import { useMemo, useState } from "react";
import type {
  IndustrialDrawingOutlineData,
  OutlineCommitPayload,
  OutlinePart,
  PptOutlineData,
  RequirementSummaryPart,
  VideoOutlineData,
  WritingOutlineData,
} from "@/lib/chat-parts";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";

type OutlineDraft = NonNullable<OutlinePart["outline"]>;
type OutlineItem = { id: string; title: string; bullets: string[] };

function isWritingOutline(outline: OutlineDraft): outline is WritingOutlineData {
  return "sections" in outline;
}

function isPptOutline(outline: OutlineDraft): outline is PptOutlineData {
  return "slides" in outline;
}

function isIndustrialDrawingOutline(
  outline: OutlineDraft,
): outline is IndustrialDrawingOutlineData {
  return "blocks" in outline;
}

function isVideoOutline(outline: OutlineDraft): outline is VideoOutlineData {
  return "blocks" in outline;
}

function headingFromMarkdown(markdown: string, fallback: string): string {
  const heading = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  return heading?.replace(/^#+\s*/, "").trim() || fallback;
}

function itemsFromOutline(outline: OutlineDraft): OutlineItem[] {
  if (isWritingOutline(outline)) return outline.sections;
  if (isPptOutline(outline)) return outline.slides;
  return outline.blocks;
}

function withItems(outline: OutlineDraft, items: OutlineItem[]): OutlineDraft {
  if (isWritingOutline(outline)) {
    return { ...outline, sections: items };
  }
  if (isPptOutline(outline)) {
    return { ...outline, slides: items };
  }
  return { ...outline, blocks: items };
}

function sanitizeOutline(outline: OutlineDraft, kind: OutlinePart["kind"]): OutlineDraft {
  const fallbackItem =
    kind === "writing_outline"
      ? "新章节"
      : kind === "ppt_outline"
        ? "新页面"
        : kind === "3d_outline"
          ? "新结构"
          : "新章节";
  const sanitized = itemsFromOutline(outline).map((item, index) => ({
    id: item.id || `${kind}-${index + 1}`,
    title: item.title.trim() || `${fallbackItem} ${index + 1}`,
    bullets: item.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  }));
  return withItems(outline, sanitized);
}

function outlineToMarkdown(
  kind: OutlinePart["kind"],
  title: string,
  outline: OutlineDraft,
): string {
  const fallbackTitle =
    kind === "writing_outline"
      ? "写作大纲"
      : kind === "ppt_outline"
        ? "PPT 页纲"
        : kind === "3d_outline"
          ? "3D 建模方案"
          : "视频 outline";
  const lines = [`# ${title.trim() || fallbackTitle}`, ""];
  itemsFromOutline(outline).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    item.bullets.forEach((bullet) => {
      lines.push(`   - ${bullet}`);
    });
  });
  return lines.join("\n");
}

function outlineTitle(part: RequirementSummaryPart | OutlinePart): string {
  return (
    part.title ??
    (part.kind === "writing_requirement_summary"
      ? "写作需求摘要"
      : part.kind === "ppt_requirement_summary"
        ? "PPT 需求摘要"
        : part.kind === "3d_requirement_summary"
          ? "3D 需求摘要"
          : part.kind === "video_requirement_summary"
            ? "视频需求摘要"
            : part.kind === "writing_outline"
              ? "写作大纲"
              : part.kind === "ppt_outline"
                ? "PPT 页纲"
                : part.kind === "3d_outline"
                  ? "3D 建模方案"
                  : "视频 outline")
  );
}

function defaultDraftTitle(part: OutlinePart): string {
  if (part.kind === "ppt_outline" && part.coverTitle?.trim()) {
    return part.coverTitle.trim();
  }
  if (part.kind === "3d_outline" && part.outline?.title?.trim()) {
    return part.outline.title.trim();
  }
  if (part.kind === "video_outline" && part.outline?.title?.trim()) {
    return part.outline.title.trim();
  }
  return headingFromMarkdown(part.markdown, outlineTitle(part));
}

function iconButtonClass(disabled?: boolean): string {
  return [
    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] transition-colors",
    disabled
      ? "cursor-not-allowed opacity-45"
      : "hover:border-[var(--accent)] hover:text-[var(--accent)]",
  ].join(" ");
}

export function RequirementSummaryCard({
  part,
  onOutlineCommitted,
}: {
  part: RequirementSummaryPart | OutlinePart;
  onOutlineCommitted?: (partId: string, patch: OutlineCommitPayload) => void;
}) {
  const title = outlineTitle(part);
  const isOutline =
    part.kind === "writing_outline" ||
    part.kind === "ppt_outline" ||
    part.kind === "3d_outline" ||
    part.kind === "video_outline";
  const structuredOutline = isOutline ? part.outline : undefined;
  const committed = Boolean(structuredOutline?.committed);
  const canEdit = isOutline && structuredOutline && !committed;

  if (canEdit) {
    return (
      <EditableRequirementSummaryCard
        key={`${part.id}:${part.completedAt ?? ""}`}
        part={part}
        title={title}
        structuredOutline={structuredOutline}
        committed={committed}
        onOutlineCommitted={onOutlineCommitted}
      />
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
          {title}
        </div>
        {committed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success)]/25 bg-[var(--success)]/10 px-2 py-1 text-[11px] font-medium text-[var(--success)]">
            <Check className="h-3 w-3" aria-hidden />
            已确认
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <ChatMarkdown markdown={normalizeMarkdown(part.markdown)} />
      </div>
    </div>
  );
}

function EditableRequirementSummaryCard({
  part,
  title,
  structuredOutline,
  committed,
  onOutlineCommitted,
}: {
  part: OutlinePart;
  title: string;
  structuredOutline: OutlineDraft;
  committed: boolean;
  onOutlineCommitted?: (partId: string, patch: OutlineCommitPayload) => void;
}) {
  const [draftOutline, setDraftOutline] = useState<OutlineDraft | undefined>(
    structuredOutline,
  );
  const [draftTitle, setDraftTitle] = useState(defaultDraftTitle(part));

  const draftItems = useMemo(
    () => (draftOutline ? itemsFromOutline(draftOutline) : []),
    [draftOutline],
  );
  const canCommit =
    Boolean(draftOutline) &&
    draftItems.some((item) => item.title.trim() || item.bullets.some(Boolean));

  const updateItems = (nextItems: OutlineItem[]) => {
    setDraftOutline((current) => (current ? withItems(current, nextItems) : current));
  };

  const updateItem = (index: number, patch: Partial<OutlineItem>) => {
    updateItems(
      draftItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateBullet = (itemIndex: number, bulletIndex: number, value: string) => {
    const item = draftItems[itemIndex];
    if (!item) return;
    updateItem(itemIndex, {
      bullets: item.bullets.map((bullet, index) =>
        index === bulletIndex ? value : bullet,
      ),
    });
  };

  const addItem = () => {
    const label =
      part.kind === "writing_outline"
        ? "新章节"
        : part.kind === "ppt_outline"
          ? "新页面"
          : part.kind === "3d_outline"
            ? "新结构"
            : "新章节";
    updateItems([
      ...draftItems,
      {
        id: `${part.kind}-${Date.now().toString(36)}`,
        title: `${label} ${draftItems.length + 1}`,
        bullets: [""],
      },
    ]);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftItems.length) return;
    const next = [...draftItems];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    updateItems(next);
  };

  const removeItem = (index: number) => {
    updateItems(draftItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const addBullet = (itemIndex: number) => {
    const item = draftItems[itemIndex];
    if (!item) return;
    updateItem(itemIndex, { bullets: [...item.bullets, ""] });
  };

  const removeBullet = (itemIndex: number, bulletIndex: number) => {
    const item = draftItems[itemIndex];
    if (!item) return;
    updateItem(itemIndex, {
      bullets: item.bullets.filter((_, index) => index !== bulletIndex),
    });
  };

  const commitOutline = () => {
    if (!draftOutline) return;
    const cleanOutline = sanitizeOutline(draftOutline, part.kind);
    const committedOutline = {
      ...cleanOutline,
      source: "user" as const,
      committed: true,
    };
    if (part.kind === "writing_outline" && isWritingOutline(committedOutline)) {
      onOutlineCommitted?.(part.id, {
        kind: part.kind,
        outline: committedOutline,
        markdown: outlineToMarkdown(part.kind, draftTitle, committedOutline),
      });
      return;
    }
    if (part.kind === "ppt_outline" && isPptOutline(committedOutline)) {
      const coverTitle = draftTitle.trim() || "PPT 页纲";
      onOutlineCommitted?.(part.id, {
        kind: part.kind,
        outline: committedOutline,
        markdown: outlineToMarkdown(part.kind, coverTitle, committedOutline),
        coverTitle,
      });
    }
    if (
      part.kind === "3d_outline" &&
      isIndustrialDrawingOutline(committedOutline)
    ) {
      const title = draftTitle.trim() || "3D 建模方案";
      onOutlineCommitted?.(part.id, {
        kind: part.kind,
        outline: {
          ...committedOutline,
          title,
        },
        markdown: outlineToMarkdown(part.kind, title, committedOutline),
      });
    }
    if (part.kind === "video_outline" && isVideoOutline(committedOutline)) {
      const title = draftTitle.trim() || "视频 outline";
      onOutlineCommitted?.(part.id, {
        kind: part.kind,
        outline: {
          ...committedOutline,
          title,
        },
        markdown: outlineToMarkdown(part.kind, title, committedOutline),
      });
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
          {title}
        </div>
        {committed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success)]/25 bg-[var(--success)]/10 px-2 py-1 text-[11px] font-medium text-[var(--success)]">
            <Check className="h-3 w-3" aria-hidden />
            已确认
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)]"
        />

          <div className="space-y-3">
            {draftItems.map((item, itemIndex) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] text-xs font-medium text-[var(--fg-tertiary)]">
                    {itemIndex + 1}
                  </span>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateItem(itemIndex, { title: event.target.value })
                    }
                    className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    className={iconButtonClass(itemIndex === 0)}
                    onClick={() => moveItem(itemIndex, -1)}
                    disabled={itemIndex === 0}
                    aria-label="上移"
                    title="上移"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass(itemIndex === draftItems.length - 1)}
                    onClick={() => moveItem(itemIndex, 1)}
                    disabled={itemIndex === draftItems.length - 1}
                    aria-label="下移"
                    title="下移"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconButtonClass(draftItems.length <= 1)}
                    onClick={() => removeItem(itemIndex)}
                    disabled={draftItems.length <= 1}
                    aria-label="删除"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-3 space-y-2 pl-9">
                  {item.bullets.map((bullet, bulletIndex) => (
                    <div key={`${item.id}-bullet-${bulletIndex}`} className="flex gap-2">
                      <input
                        value={bullet}
                        onChange={(event) =>
                          updateBullet(itemIndex, bulletIndex, event.target.value)
                        }
                        className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        className={iconButtonClass(item.bullets.length <= 1)}
                        onClick={() => removeBullet(itemIndex, bulletIndex)}
                        disabled={item.bullets.length <= 1}
                        aria-label="删除要点"
                        title="删除要点"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => addBullet(itemIndex)}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    添加要点
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={addItem}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {part.kind === "writing_outline"
                ? "新增一节"
                : part.kind === "ppt_outline"
                  ? "新增一页"
                  : part.kind === "3d_outline"
                    ? "新增结构"
                    : "新增章节"}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={commitOutline}
              disabled={!canCommit}
            >
              <Check className="h-4 w-4" aria-hidden />
              确认采用
            </button>
          </div>
      </div>
    </div>
  );
}
