"use client";

import { AssetListPanel } from "./panels/AssetListPanel";
import { KnowledgePanel } from "./panels/KnowledgePanel";
import { MeetingHistoryPanel } from "./panels/MeetingHistoryPanel";
import { PptPanel } from "./panels/PptPanel";
import { TranslatePanel } from "./panels/TranslatePanel";
import { UploadPanel } from "./panels/UploadPanel";
import { WritingPanel } from "./panels/WritingPanel";
import {
  MOCK_PPT_ASSETS,
  MOCK_WRITING_ASSETS,
} from "@/lib/module-mock-data";

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

  if (pathname === "/translate/document") {
    return <TranslatePanel variant="document" />;
  }
  if (pathname === "/translate/text") {
    return <TranslatePanel variant="text" />;
  }
  if (pathname === "/translate/history") {
    return <TranslatePanel variant="history" />;
  }

  if (pathname === "/writing/mine") {
    return <AssetListPanel variant="writing" items={MOCK_WRITING_ASSETS} />;
  }
  if (pathname === "/ppt/mine") {
    return <AssetListPanel variant="ppt" items={MOCK_PPT_ASSETS} />;
  }

  if (pathname.startsWith("/ppt/")) {
    if (pathname === "/ppt/from-writing") {
      return <PptPanel pathname={pathname} variant="from-writing" />;
    }
    if (pathname === "/ppt/templates") {
      return <PptPanel pathname={pathname} variant="template" />;
    }
    if (pathname === "/ppt/new") {
      return <PptPanel pathname={pathname} variant="new" />;
    }
  }

  if (
    pathname.startsWith("/writing/") &&
    pathname !== "/writing/mine" &&
    pathname !== "/writing/new"
  ) {
    return <WritingPanel pathname={pathname} />;
  }
  if (pathname === "/writing/new") {
    return <WritingPanel pathname={pathname} flow="blank" />;
  }

  return null;
}
