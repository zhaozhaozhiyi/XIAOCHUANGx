import { SubNav } from "./SubNav";
import type { NavModule } from "@/lib/navigation";
import { getSubNavItem } from "@/lib/navigation";

type ModuleWorkspaceProps = {
  module: NavModule;
  pathname: string;
  children?: React.ReactNode;
};

export function ModuleWorkspace({
  module: mod,
  pathname,
  children,
}: ModuleWorkspaceProps) {
  const current = getSubNavItem(pathname) ?? mod.subNav[0];

  return (
    <>
      <SubNav module={mod} />
      <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-6">
        <header className="mb-6">
          <h1 className="text-h1 text-[var(--fg)]">{current?.label ?? mod.label}</h1>
          {current?.description && (
            <p className="prose-width mt-2 text-sm text-[var(--fg-secondary)]">
              {current.description}
            </p>
          )}
        </header>
        {children ?? <PlaceholderPanel moduleLabel={mod.label} tabLabel={current?.label} />}
      </div>
    </>
  );
}

function PlaceholderPanel({
  moduleLabel,
  tabLabel,
}: {
  moduleLabel: string;
  tabLabel?: string;
}) {
  return (
    <div className="card-flat mx-auto max-w-2xl p-12 text-center">
      <p className="text-sm text-[var(--fg-secondary)]">
        {moduleLabel} · {tabLabel ?? "—"}
      </p>
      <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
        功能原型占位，后续接入业务能力
      </p>
    </div>
  );
}
