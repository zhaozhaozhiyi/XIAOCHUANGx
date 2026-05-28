"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import type { ChatAttachment, ChatMessage } from "@/lib/chat";
import { formatAttachmentSize } from "@/lib/chat-attachments";



function getAttachmentIconInfo(name: string, extension?: string) {
  const ext = (extension || name.split(".").pop() || "").toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return { type: "table", className: "chat-user-attachment__icon--table" };
  }
  if (ext === "pdf") {
    return { type: "pdf", className: "chat-user-attachment__icon--pdf" };
  }
  if (
    ext === "html" ||
    ext === "htm" ||
    ext === "js" ||
    ext === "ts" ||
    ext === "tsx" ||
    ext === "jsx" ||
    ext === "json" ||
    ext === "py" ||
    ext === "css" ||
    ext === "yaml" ||
    ext === "yml" ||
    ext === "md"
  ) {
    return { type: "code", className: "chat-user-attachment__icon--code" };
  }
  if (
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "gif" ||
    ext === "webp" ||
    ext === "svg" ||
    ext === "avif"
  ) {
    return { type: "image", className: "chat-user-attachment__icon--image" };
  }
  return { type: "file", className: "chat-user-attachment__icon--file" };
}

function AttachmentChip({ attachment }: { attachment: ChatAttachment }) {
  const info = getAttachmentIconInfo(attachment.name, attachment.extension);

  return (
    <div
      className="chat-user-attachment"
      title={`${attachment.name} · ${formatAttachmentSize(attachment.size)}`}
    >
      <span className={`chat-user-attachment__icon ${info.className}`} aria-hidden>
        {info.type === "table" && (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="currentColor" fillOpacity="0.1" />
            <path d="M14 2V8H20" />
            <rect x="6" y="10" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
            <path d="M8 12L11 15M11 12L8 15" stroke="white" strokeWidth="1.2" />
          </svg>
        )}
        {info.type === "pdf" && (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="currentColor" fillOpacity="0.1" />
            <path d="M14 2V8H20" />
            <rect x="6" y="11" width="10" height="6" rx="1" fill="currentColor" stroke="none" />
            <text x="7.5" y="15.5" fill="white" fontSize="4.5" fontWeight="bold" fontFamily="system-ui, sans-serif" stroke="none">PDF</text>
          </svg>
        )}
        {info.type === "code" && (
          <span className="text-[9px] font-mono font-bold leading-none">&lt;/&gt;</span>
        )}
        {info.type === "image" && (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        )}
        {info.type === "file" && (
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </span>
      <span className="min-w-0 truncate">{attachment.name}</span>
    </div>
  );
}

function ImageAttachmentPreview({
  attachment,
  sessionId,
}: {
  attachment: ChatAttachment;
  sessionId: string;
}) {
  const [failed, setFailed] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showLightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowLightbox(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLightbox]);

  if (failed || !sessionId) {
    return <AttachmentChip attachment={attachment} />;
  }

  const imageUrl = `/api/sessions/${encodeURIComponent(
    sessionId
  )}/attachments?name=${encodeURIComponent(attachment.name)}`;

  return (
    <>
      <div
        className="chat-user-attachment-image"
        title={`${attachment.name} · ${formatAttachmentSize(attachment.size)}`}
        onClick={() => setShowLightbox(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={attachment.name}
          onError={() => setFailed(true)}
        />
      </div>

      {showLightbox && mounted && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-md cursor-zoom-out animate-fade-in"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-[75vw] max-h-[70vh] transition-all duration-300 transform scale-100 ease-out select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={attachment.name}
              className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border border-white/10 object-contain animate-scale-up"
            />
            <button
              type="button"
              className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/10 shadow-md"
              aria-label="关闭预览"
              onClick={(e) => {
                e.stopPropagation();
                setShowLightbox(false);
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function UserMessageBubble({ message }: { message: ChatMessage }) {
  const attachments = message.attachments ?? [];
  const params = useParams();
  const sessionId = typeof params?.id === "string" ? params.id : "";

  return (
    <div className="chat-user-message">
      {attachments.length > 0 ? (
        <div className="chat-user-attachments" aria-label="附件">
          {attachments.map((attachment, index) => {
            const info = getAttachmentIconInfo(attachment.name, attachment.extension);
            const isImg = attachment.isImage || info.type === "image";

            if (isImg) {
              return (
                <ImageAttachmentPreview
                  key={`${attachment.id}-${index}`}
                  attachment={attachment}
                  sessionId={sessionId}
                />
              );
            }

            return (
              <AttachmentChip
                key={`${attachment.id}-${index}`}
                attachment={attachment}
              />
            );
          })}
        </div>
      ) : null}
      {message.content.trim() ? (
        <div className="bubble-user whitespace-pre-wrap">{message.content}</div>
      ) : null}
    </div>
  );
}
