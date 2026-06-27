import { notFound } from "next/navigation";
import { ModulePageClient } from "@/components/layout/ModulePageClient";
import { NAV_MODULES } from "@/lib/navigation";

export default async function ModuleTabPage({
  params,
}: {
  params: Promise<{ module: string; tab: string }>;
}) {
  const { module: moduleSlug, tab } = await params;
  const mod = NAV_MODULES.find((m) => m.id === moduleSlug);
  if (!mod) notFound();

  const href = `/${moduleSlug}/${tab}`;
  const valid = mod.subNav.some((s) => s.href === href);
  if (!valid) notFound();

  return <ModulePageClient moduleId={mod.id} />;
}
