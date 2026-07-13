import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CANVAS_ACTION_REGISTRY,
  resolveCanvasActionBehavior,
  resolveCanvasActionCreatesNewRound,
  resolveCanvasActionRequiresConfirmation,
  type CanvasActionContext,
} from "../web/src/components/simulation/canvas/canvasActions";

type SnapshotRow = {
  actionId: string;
  behaviorType: string;
  targetKind: string;
  createsNewRound: boolean;
  requiresConfirmation: boolean;
  variants?: Record<
    string,
    {
      behaviorType: string;
      createsNewRound: boolean;
      requiresConfirmation: boolean;
    }
  >;
};

const CONTEXTS: Record<string, CanvasActionContext> = {
  hasWorldModel: { hasWorldModel: true },
  coreBoundaryChange: { hasWorldModel: true, changesCoreBoundary: true },
};

function buildSnapshot(): SnapshotRow[] {
  return Object.values(CANVAS_ACTION_REGISTRY)
    .map((definition) => {
      const baseContext: CanvasActionContext = {};
      const row: SnapshotRow = {
        actionId: definition.actionId,
        behaviorType:
          resolveCanvasActionBehavior(definition.actionId, baseContext) ??
          definition.defaultBehaviorType,
        targetKind: definition.targetKind,
        createsNewRound:
          resolveCanvasActionCreatesNewRound(definition.actionId, baseContext) ?? false,
        requiresConfirmation:
          resolveCanvasActionRequiresConfirmation(definition.actionId, baseContext) ??
          false,
      };
      const variants = Object.fromEntries(
        Object.entries(CONTEXTS).map(([key, context]) => [
          key,
          {
            behaviorType:
              resolveCanvasActionBehavior(definition.actionId, context) ??
              definition.defaultBehaviorType,
            createsNewRound:
              resolveCanvasActionCreatesNewRound(definition.actionId, context) ??
              false,
            requiresConfirmation:
              resolveCanvasActionRequiresConfirmation(definition.actionId, context) ??
              false,
          },
        ]),
      );
      if (
        Object.values(variants).some(
          (variant) =>
            variant.behaviorType !== row.behaviorType ||
            variant.createsNewRound !== row.createsNewRound ||
            variant.requiresConfirmation !== row.requiresConfirmation,
        )
      ) {
        row.variants = variants;
      }
      return row;
    })
    .sort((left, right) => left.actionId.localeCompare(right.actionId));
}

const snapshot = buildSnapshot();

if (process.argv.includes("--print")) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(
  scriptDir,
  "fixtures",
  "simulation-action-registry.snapshot.json",
);
const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));

if (JSON.stringify(snapshot, null, 2) !== JSON.stringify(expected, null, 2)) {
  console.error("simulation action registry snapshot mismatch");
  console.error("Run: pnpm smoke:simulation:actions -- --print");
  console.error(JSON.stringify(snapshot, null, 2));
  process.exit(1);
}

console.log(`ok simulation action registry snapshot (${snapshot.length} actions)`);
