import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome />
    </Suspense>
  );
}
