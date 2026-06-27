import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function TranslateNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="translate" />
    </Suspense>
  );
}
