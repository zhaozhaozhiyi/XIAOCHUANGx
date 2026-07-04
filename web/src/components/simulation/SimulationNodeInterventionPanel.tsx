"use client";

import {
  SimulationActionButton,
  SimulationActionButtonRow,
} from "@/components/simulation/SimulationActionButtons";
import {
  buildNodeExpandPrompt,
  buildVariableInterventionPrompt,
  type SimulationInterventionAction,
} from "@/components/simulation/SimulationPromptBuilders";
import type { SimulationNode } from "@/lib/chat-parts";

type VariableDrafts = Record<string, string>;

type PendingInterventionPayload = {
  title: string;
  targetNodeId: string;
  targetLabel: string;
  nextValue?: string;
  impactLines: string[];
  message: string;
};

type SimulationNodeInterventionPanelProps = {
  node: SimulationNode;
  nodeTypeLabel: string;
  variableDrafts: VariableDrafts;
  impactLines: string[];
  actions: SimulationInterventionAction[];
  onDraftChange: (nodeId: string, value: string) => void;
  onContinueAsMessage?: (message: string) => void;
  onPendingIntervention: (payload: PendingInterventionPayload) => void;
};

function valueText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

function variableSchemaLines(node: SimulationNode): string[] {
  const schema = node.valueSchema;
  if (!schema) return [];
  return [
    `变量类型：${schema.kind}`,
    schema.unit ? `变量单位：${schema.unit}` : "",
    schema.options?.length ? `可选值：${schema.options.join("、")}` : "",
    schema.range ? `可调范围：${schema.range[0]} - ${schema.range[1]}` : "",
    node.locked ? "锁定状态：是" : "锁定状态：否",
  ].filter(Boolean);
}

export function SimulationNodeInterventionPanel({
  node,
  nodeTypeLabel,
  variableDrafts,
  impactLines,
  actions,
  onDraftChange,
  onContinueAsMessage,
  onPendingIntervention,
}: SimulationNodeInterventionPanelProps) {
  return (
    <>
      {node.value != null ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
          <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
            当前假设
          </div>
          <div className="mt-1 text-sm text-[var(--fg)]">
            {String(node.value)}
            {node.valueSchema?.unit ? node.valueSchema.unit : ""}
          </div>
        </div>
      ) : null}
      {node.type === "variable" && node.valueSchema ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
          <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
            调整变量
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <VariableDraftInput
              node={node}
              value={variableDrafts[node.id] ?? valueText(node.value)}
              onChange={(value) => onDraftChange(node.id, value)}
            />
            {onContinueAsMessage ? (
              <SimulationActionButtonRow withTopMargin={false}>
                {[
                  {
                    label: "查看影响",
                    value: "查看影响",
                    instruction:
                      "请只输出该变量影响哪些节点、边、Scenario、Risk 和 Conclusion，不要开始重算。",
                  },
                  {
                    label: "锁定变量",
                    value: "锁定变量",
                    instruction:
                      "请将该变量作为后续推演约束，说明锁定后会限制哪些路径变化，并等待用户确认是否生成新 Round。",
                  },
                  {
                    label: "恢复默认",
                    value: "恢复默认",
                    instruction:
                      "请清除用户覆盖，将变量恢复到默认值，再说明恢复会影响哪些下游路径和结论。",
                  },
                  {
                    label: "确认重算",
                    value: "确认重算",
                    instruction:
                      "请先说明影响预览，再重算下游 Scenario、Inference、Risk 和 Conclusion，并保留旧轮次可回看。",
                  },
                ].map((item) => (
                  <SimulationActionButton
                    key={item.value}
                    onClick={() => {
                      const currentValue = valueText(node.value);
                      const defaultValue = valueText(node.defaultValue);
                      const nextValue =
                        item.value === "恢复默认"
                          ? defaultValue
                          : variableDrafts[node.id] ?? currentValue;
                      if (item.value === "恢复默认" && defaultValue) {
                        onDraftChange(node.id, defaultValue);
                      }
                      const message = buildVariableInterventionPrompt({
                        node,
                        operation: item.value,
                        currentValue,
                        defaultValue,
                        nextValue,
                        schemaLines: variableSchemaLines(node),
                        impactLines,
                        instruction: item.instruction,
                        confirmationLine:
                          item.value === "确认重算"
                            ? "确认重算属于硬选择点，请在同一 Run 内生成新 Round。"
                            : "不要静默改写画布；先说明影响和后续可选动作。",
                      });
                      if (item.value === "确认重算") {
                        onPendingIntervention({
                          title: "变量重算",
                          targetNodeId: node.id,
                          targetLabel: node.label,
                          nextValue,
                          impactLines,
                          message,
                        });
                        return;
                      }
                      onContinueAsMessage(message);
                    }}
                  >
                    {item.label}
                  </SimulationActionButton>
                ))}
              </SimulationActionButtonRow>
            ) : null}
          </div>
        </div>
      ) : null}
      {actions.length > 0 && onContinueAsMessage ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
          <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
            可干预动作
          </div>
          <SimulationActionButtonRow>
            {actions.map((action) => (
              <SimulationActionButton
                key={action.label}
                onClick={() => onContinueAsMessage(action.prompt)}
              >
                {action.label}
              </SimulationActionButton>
            ))}
          </SimulationActionButtonRow>
        </div>
      ) : null}
      {onContinueAsMessage ? (
        <button
          type="button"
          onClick={() =>
            onContinueAsMessage(
              buildNodeExpandPrompt({
                node,
                nodeTypeLabel,
                impactLines,
              }),
            )
          }
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          沿此节点展开
        </button>
      ) : null}
    </>
  );
}

function VariableDraftInput({
  node,
  value,
  onChange,
}: {
  node: SimulationNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const schema = node.valueSchema;
  if (!schema) return null;

  if (schema.kind === "enum" && schema.options?.length) {
    return (
      <select
        aria-label={`调整${node.label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
      >
        {schema.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (schema.kind === "boolean") {
    return (
      <select
        aria-label={`调整${node.label}`}
        value={value || "true"}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
      >
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    );
  }

  if (schema.kind === "number" && schema.range) {
    const sliderValue = value || String(schema.range[0]);
    return (
      <div className="flex min-w-[190px] items-center gap-2">
        <input
          aria-label={`调整${node.label}`}
          type="range"
          min={schema.range[0]}
          max={schema.range[1]}
          value={sliderValue}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span className="w-14 text-right text-xs text-[var(--fg-secondary)]">
          {sliderValue}
          {schema.unit ?? ""}
        </span>
      </div>
    );
  }

  return (
    <input
      aria-label={`调整${node.label}`}
      type={
        schema.kind === "number"
          ? "number"
          : schema.kind === "datetime"
            ? "datetime-local"
            : "text"
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-40 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
      placeholder="新假设"
    />
  );
}
