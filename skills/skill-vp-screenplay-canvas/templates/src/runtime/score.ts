import type { SequenceDef } from "./models";
import PilotScene from "../sequences/00-pilot/PilotScene";
import { cues as pilotCues } from "../sequences/00-pilot/cues";

export const SCORE: SequenceDef[] = [
  {
    id: "pilot",
    label: "Pilot Sequence",
    cues: pilotCues,
    Scene: PilotScene,
  },
];
