"use client";

import { useCallback } from "react";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import {
  parseFileRef,
  resolveFileMessage,
  type ParsedFileRef,
} from "@/lib/file-path-resolve";

export type OpenFileAtInput = ParsedFileRef & {
  /** 原始路径字符串（含行号后缀时自动 parse） */
  path?: string;
};

export function useOpenFileAt() {
  const ws = useWorkspaceOptional();

  const openFileAt = useCallback(
    (input: OpenFileAtInput | string) => {
      const parsed =
        typeof input === "string"
          ? parseFileRef(input)
          : parseFileRef(input.path ?? "");
      const line =
        typeof input === "string" ? parsed.line : (input.line ?? parsed.line);
      const endLine =
        typeof input === "string"
          ? parsed.endLine
          : (input.endLine ?? parsed.endLine);
      if (!ws) return false;
      return ws.openFileAt({
        relativePath: parsed.path,
        line,
        endLine,
      });
    },
    [ws],
  );

  return { openFileAt, workspaceReady: !!ws };
}

export { resolveFileMessage };
