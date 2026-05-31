import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function PptNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="ppt" />
    </Suspense>
  );
}
