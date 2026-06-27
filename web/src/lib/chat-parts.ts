import type {
  IndustrialDrawingOutlineData,
  PptOutlineData,
  VideoOutlineData,
  WritingOutlineData,
} from "@jlc/contracts";

export type {
  ActivityCollapse,
  ArtifactPart,
  CommandPart,
  CanonicalArtifact,
  CanonicalCitation,
  CanonicalEvent,
  CanonicalEventType,
  CanonicalExecutionClass,
  CanonicalFinalAnswer,
  CanonicalNextAction,
  CanonicalNextActionType,
  CanonicalOutcome,
  CanonicalOutputPayload,
  CanonicalOutputDebug,
  CanonicalProviderInfo,
  CanonicalRationale,
  CanonicalRunOutcomeStatus,
  CanonicalToolStatus,
  CanonicalTurnOutput,
  CanonicalWorkspaceChange,
  ChatMessageCanonicalEnvelope,
  DeliverableItem,
  DeliverablesPart,
  DocumentEditPart,
  DocumentReadPart,
  ChatMessageStatus,
  ChatPart,
  ChatPartKind,
  ChatPartZone,
  ClarificationPart,
  ClarificationQuestion,
  IndustrialDrawingOutlineData,
  IndustrialDrawingOutlinePart,
  VideoOutlineData,
  VideoOutlinePart,
  RequirementsPart,
  RequirementSummaryPart,
  OutlinePart,
  OutlineSource,
  PptOutlineData,
  PptOutlinePart,
  PptOutlineSlide,
  StructuredQuestion,
  StructuredQuestionOption,
  SummaryPart,
  WritingOutlineData,
  WritingOutlinePart,
  WritingOutlineSection,
  ErrorPart,
  FileEditPart,
  FileReadPart,
  NarrationPart,
  SkillPart,
  StatusChipPart,
  StatusPart,
  TextPart,
  TodoItem,
  TodoPart,
  ToolBatchItem,
  ToolBatchPart,
  ToolPart,
  TurnMetaPart,
} from "@jlc/contracts";

export type OutlineCommitPayload =
  | {
      kind: "writing_outline";
      outline: WritingOutlineData;
      markdown: string;
    }
  | {
      kind: "ppt_outline";
      outline: PptOutlineData;
      markdown: string;
      coverTitle: string;
    }
  | {
      kind: "3d_outline";
      outline: IndustrialDrawingOutlineData;
      markdown: string;
    }
  | {
      kind: "video_outline";
      outline: VideoOutlineData;
      markdown: string;
    };

export {
  CHAT_OUTPUT_PROTOCOL_VERSION,
  CHAT_PARTS_PROTOCOL_VERSION,
} from "@jlc/contracts";
