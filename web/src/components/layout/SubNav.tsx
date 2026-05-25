"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavModule } from "@/lib/navigation";

export function SubNav({ module: mod }: { module: NavModule }) {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg)] px-4 py-2">
      {mod.subNav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "subnav-pill subnav-pill-active" : "subnav-pill"}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
