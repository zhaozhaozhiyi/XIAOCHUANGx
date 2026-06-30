import { Suspense } from "react";
import { ChatHome } from "@/components/chat/ChatHome";

export default function SimulationNewPage() {
  return (
    <Suspense fallback={null}>
      <ChatHome surfaceModuleId="simulation" />
    </Suspense>
  );
}
