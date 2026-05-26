const GREETING_PATTERN =
  /^(?:你?好+|您好+|哈喽+|嗨+|hi+|hello+|hey+|在吗|在不在|有人吗|早上好|中午好|下午好|晚上好)[!！。,.，\s~～]*$/i;

const THANKS_PATTERN =
  /^(?:谢了|谢谢|感谢|多谢|thanks|thank you|thx)[!！。,.，\s~～]*$/i;

const ACK_PATTERN =
  /^(?:嗯+|好+|好的|可以|收到|明白|了解|ok|okay|👌)[!！。,.，\s~～]*$/i;

export type LightweightConversationKind = "greeting" | "thanks" | "ack";

export function classifyLightweightConversation(
  text: string,
  options: { hasConversationContext?: boolean } = {},
): LightweightConversationKind | null {
  const normalized = text.trim();
  if (!normalized || normalized.length > 24) return null;
  if (GREETING_PATTERN.test(normalized)) return "greeting";
  if (THANKS_PATTERN.test(normalized)) return "thanks";
  if (options.hasConversationContext) return null;
  if (ACK_PATTERN.test(normalized)) return "ack";
  return null;
}

export function buildLightweightConversationReply(
  kind: LightweightConversationKind,
): string {
  if (kind === "thanks") {
    return "不客气。你可以继续把要处理的内容发给我。";
  }
  if (kind === "ack") {
    return "好的。你继续说，我会接着处理。";
  }
  return "你好，我在。你可以直接告诉我要处理什么，例如查资料、整理文档、写报告、做 PPT 大纲、翻译或分析数据。";
}
