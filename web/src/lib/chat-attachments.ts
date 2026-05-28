import type { ChatAttachment, ChatPendingAttachment } from "@/lib/chat";

type UploadAttachmentResponse = {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  extension?: string;
  textContent?: string;
  truncated?: boolean;
  contentBase64?: string;
};

export function persistedAttachment(
  attachment: ChatPendingAttachment,
): ChatAttachment {
  const persisted = { ...attachment };
  delete persisted.file;
  delete persisted.contentBase64;
  return persisted;
}

export async function uploadChatAttachments(
  sessionId: string,
  attachments: ChatPendingAttachment[] | undefined,
  projectId?: string,
  signal?: AbortSignal,
): Promise<ChatAttachment[] | undefined> {
  if (!attachments?.length) return undefined;
  const uploaded = await Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.file) return { ...attachment };

      const res = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/attachments`,
        {
          method: "POST",
          headers: {
            "Content-Type": attachment.file.type || "application/octet-stream",
            "X-JLC-Upload-Mode": "raw",
            "X-JLC-File-Name": encodeURIComponent(attachment.file.name),
            "X-JLC-File-Size": String(attachment.file.size),
            ...(projectId
              ? { "X-JLC-Project-Id": encodeURIComponent(projectId) }
              : {}),
          },
          body: attachment.file,
          signal,
        },
      );
      if (!res.ok) {
        let message = `附件上传失败 (${res.status})`;
        try {
          const json = (await res.json()) as { message?: string; error?: string };
          message = json.message ?? json.error ?? message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const json = (await res.json()) as UploadAttachmentResponse;
      return {
        ...persistedAttachment(attachment),
        id: json.id,
        name: json.name,
        path: json.path,
        size: json.size,
        mimeType: json.mimeType,
        type: json.mimeType,
        isImage: json.isImage,
        extension: json.extension ?? attachment.extension,
        textContent: json.textContent ?? attachment.textContent,
        truncated: json.truncated ?? attachment.truncated,
        contentBase64: json.contentBase64,
      };
    }),
  );
  return uploaded;
}

export function formatAttachmentSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${Number(kb.toFixed(kb >= 10 ? 0 : 1))} KB`;
  const mb = kb / 1024;
  return `${Number(mb.toFixed(mb >= 10 ? 0 : 1))} MB`;
}
