"use client";

import { createContext, useContext } from "react";
import type { SimulationTopicAnalysisActivity } from "@/lib/simulation-topic-analysis-activity";

const SimulationCanvasActivityContext =
  createContext<SimulationTopicAnalysisActivity | null>(null);

export const SimulationCanvasActivityProvider =
  SimulationCanvasActivityContext.Provider;

export function useSimulationCanvasActivity() {
  return useContext(SimulationCanvasActivityContext);
}
