import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function VideoNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="video" />
    </Suspense>
  );
}
