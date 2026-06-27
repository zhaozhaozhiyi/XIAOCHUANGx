/** 流式表格常被压成一行：| 列A | 列B ||---|---|| 1 | … */
function normalizeCompressedTables(text: string): string {
  return text.replace(/\|\|/g, "|\n|");
}

/** 助手正文展示前规范化 */
export function prepareChatMarkdown(text: string): string {
  return normalizeCompressedTables(
    text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "")
      .replace(/\n{3,}/g, "\n\n"),
  );
}
