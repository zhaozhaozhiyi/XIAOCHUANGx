import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function WritingNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="writing" />
    </Suspense>
  );
}
