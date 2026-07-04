import type { ComponentType } from "react";

export interface SceneBeatProps {
  beat: number;
}

export type CueLine = string;

export interface SequenceDef {
  id: string;
  label: string;
  cues: CueLine[];
  Scene: ComponentType<SceneBeatProps>;
}
