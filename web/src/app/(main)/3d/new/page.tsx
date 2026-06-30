import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function ThreeDNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="3d" />
    </Suspense>
  );
}
