"use client";

import { usePathname } from "next/navigation";
import { NAV_MODULES } from "@/lib/navigation";
import { ModuleWorkspace } from "./ModuleWorkspace";
import { ModuleContent } from "@/components/modules/ModuleContent";

export function ModulePageClient({ moduleId }: { moduleId: string }) {
  const pathname = usePathname();
  const mod = NAV_MODULES.find((m) => m.id === moduleId);

  if (!mod) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
        页面不存在
      </div>
    );
  }

  return (
    <ModuleWorkspace module={mod} pathname={pathname}>
      <ModuleContent moduleId={moduleId} pathname={pathname} />
    </ModuleWorkspace>
  );
}
