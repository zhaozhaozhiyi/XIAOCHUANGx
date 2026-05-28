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
};

export function persistedAttachment(
  attachment: ChatPendingAttachment,
): ChatAttachment {
  const persisted = { ...attachment };
  delete persisted.file;
  return persisted;
}

export async function uploadChatAttachments(
  sessionId: string,
  attachments: ChatPendingAttachment[] | undefined,
  signal?: AbortSignal,
): Promise<ChatAttachment[] | undefined> {
  if (!attachments?.length) return undefined;
  const uploaded = await Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.file) return persistedAttachment(attachment);

      const form = new FormData();
      form.append("file", attachment.file, attachment.file.name);
      if (attachment.textContent) {
        form.append("textContent", attachment.textContent);
      }
      if (attachment.truncated != null) {
        form.append("truncated", String(attachment.truncated));
      }

      const res = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/attachments`,
        {
          method: "POST",
          body: form,
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
      };
    }),
  );
  return uploaded;
}
