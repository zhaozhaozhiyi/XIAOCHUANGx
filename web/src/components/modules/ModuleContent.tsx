"use client";

type Props = { moduleId: string; pathname: string };

export function ModuleContent({ moduleId, pathname }: Props) {
  void pathname;
  if (moduleId === "simulation") {
    return <SimulationBetaPanel />;
  }

  void moduleId;
  return null;
}

function SimulationBetaPanel() {
  return (
    <div className="card-flat mx-auto max-w-3xl p-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-[var(--accent)]">
          Simulation Canvas
        </p>
        <h2 className="text-h2 text-[var(--fg)]">推演沙盘观察舱</h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">
          这里将承接多智能体推演、路径选择、变量调整、沙盘回放与报告输出。当前为
          Beta 入口，后续会接入完整推演画布。
        </p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["入口收敛", "选择问题类型、初始假设与推演方向"],
          ["沙盘画布", "查看主体、变量、路径、阶段与轮次"],
          ["报告输出", "生成推演总结、综合分析和续推建议"],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
            <p className="text-sm font-semibold text-[var(--fg)]">{title}</p>
            <p className="mt-2 text-xs leading-5 text-[var(--fg-secondary)]">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
