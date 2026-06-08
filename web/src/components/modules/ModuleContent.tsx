"use client";

import { KnowledgePanel } from "./panels/KnowledgePanel";
import { MeetingHistoryPanel } from "./panels/MeetingHistoryPanel";
import { UploadPanel } from "./panels/UploadPanel";

type Props = { moduleId: string; pathname: string };

export function ModuleContent({ moduleId, pathname }: Props) {
  if (pathname === "/meeting/new") {
    return <UploadPanel />;
  }
  if (pathname === "/meeting/history") {
    return <MeetingHistoryPanel />;
  }

  if (pathname === "/knowledge/documents") {
    return <KnowledgePanel variant="documents" />;
  }
  if (pathname === "/knowledge/qa") {
    return <KnowledgePanel variant="qa" />;
  }
  if (pathname === "/knowledge/sources") {
    return <KnowledgePanel variant="sources" />;
  }

  return null;
}
