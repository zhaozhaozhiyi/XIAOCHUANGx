"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AGENT_DEFINITIONS, type AgentId } from "@/lib/settings";

export function ModelPicker({
  agentId,
  value,
  onChange,
}: {
  agentId: AgentId;
  value: string;
  onChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId)!;
  const current = agent.models.find((m) => m.id === value) ?? agent.models[0]!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!agent.models.some((m) => m.id === value)) {
      onChange(agent.models[0]!.id);
    }
  }, [agentId, agent.models, value, onChange]);

  return (
    <div className="relative max-w-[7.5rem]" ref={rootRef}>
      <button
        type="button"
        className="control-picker control-picker--compact w-full"
        aria-label="选择模型档位"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 truncate">{current.label}</span>
        <ChevronDown
          className={`control-picker__chevron shrink-0 ${open ? "control-picker__chevron--open" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open && (
        <ul className="control-picker-menu control-picker-menu--compact control-picker-menu--above absolute bottom-full right-0 mb-1.5 min-w-[9rem]">
          {agent.models.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`control-picker-menu__item ${
                  m.id === value ? "control-picker-menu__item--selected" : ""
                }`}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
