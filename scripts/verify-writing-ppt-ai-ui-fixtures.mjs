#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, "docs/qa/writing-ppt-ai-ui-fixtures.json");

const allowedModuleIds = new Set(["writing", "ppt", "mixed"]);
const allowedPartKinds = new Set([
  "writing_requirements",
  "writing_requirement_summary",
  "writing_outline",
  "ppt_requirements",
  "ppt_requirement_summary",
  "ppt_outline",
  "deliverables",
  "draft",
]);
const expectedFirstTurnIds = ["F1", "F2", "F3", "F4", "F5", "F6"];
const expectedFlowIds = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"];

function fail(message) {
  throw new Error(message);
}

function readFixture() {
  const raw = fs.readFileSync(fixturePath, "utf8");
  return JSON.parse(raw);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function assertUniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    const id = assertString(item.id, `${label}.id`);
    if (ids.has(id)) fail(`duplicate ${label} id: ${id}`);
    ids.add(id);
  }
  return ids;
}

function assertPartList(parts, label) {
  if (parts == null) return;
  assertArray(parts, label);
  for (const part of parts) {
    if (!allowedPartKinds.has(part)) {
      fail(`${label} contains unknown part kind: ${part}`);
    }
  }
}

function assertExpectedIds(actualIds, expectedIds, label) {
  for (const id of expectedIds) {
    if (!actualIds.has(id)) fail(`${label} missing ${id}`);
  }
}

function validateFirstTurnFixtures(fixtures) {
  const ids = assertUniqueIds(fixtures, "firstTurnFixtures");
  assertExpectedIds(ids, expectedFirstTurnIds, "firstTurnFixtures");

  for (const fixture of fixtures) {
    if (!["writing", "ppt"].includes(fixture.moduleId)) {
      fail(`${fixture.id}.moduleId must be writing or ppt`);
    }
    assertString(fixture.input, `${fixture.id}.input`);
    if (!fixture.expect || typeof fixture.expect !== "object") {
      fail(`${fixture.id}.expect is required`);
    }
    assertPartList(fixture.expect.requiredParts, `${fixture.id}.expect.requiredParts`);
    assertPartList(fixture.expect.requiredAnyParts, `${fixture.id}.expect.requiredAnyParts`);
    assertPartList(fixture.expect.forbiddenParts, `${fixture.id}.expect.forbiddenParts`);
    if (!fixture.expect.requiredParts && !fixture.expect.requiredAnyParts) {
      fail(`${fixture.id} must declare requiredParts or requiredAnyParts`);
    }
  }

  return ids;
}

function validateFlowFixtures(fixtures, firstTurnIds) {
  const ids = assertUniqueIds(fixtures, "flowFixtures");
  assertExpectedIds(ids, expectedFlowIds, "flowFixtures");

  for (const fixture of fixtures) {
    if (!allowedModuleIds.has(fixture.moduleId)) {
      fail(`${fixture.id}.moduleId is invalid: ${fixture.moduleId}`);
    }
    if (fixture.inputRef && !firstTurnIds.has(fixture.inputRef)) {
      fail(`${fixture.id}.inputRef points to missing first-turn fixture: ${fixture.inputRef}`);
    }
    if (!fixture.inputRef && !fixture.input && !fixture.operation) {
      fail(`${fixture.id} must declare input, inputRef, or operation`);
    }
    assertPartList(fixture.expectedStages, `${fixture.id}.expectedStages`);
    assertPartList(fixture.mustNotEmit, `${fixture.id}.mustNotEmit`);
    if (fixture.expectedArtifacts != null) {
      assertArray(fixture.expectedArtifacts, `${fixture.id}.expectedArtifacts`);
      for (const artifact of fixture.expectedArtifacts) {
        assertString(artifact.extension, `${fixture.id}.expectedArtifacts.extension`);
        if (!artifact.extension.startsWith(".")) {
          fail(`${fixture.id}.expectedArtifacts extension must start with "."`);
        }
      }
    }
    if (fixture.outline) {
      if (fixture.outline.requiresCommittedUserVersion !== true) {
        fail(`${fixture.id}.outline must require committed user version`);
      }
      if (fixture.outline.requiresStructured !== true) {
        fail(`${fixture.id}.outline must require structured outline`);
      }
    }
  }
}

function main() {
  const fixture = readFixture();
  if (fixture.version !== 1) fail("fixture.version must be 1");
  if (fixture.scope !== "writing-ppt-ai-ui") fail("fixture.scope mismatch");

  const firstTurnFixtures = assertArray(
    fixture.firstTurnFixtures,
    "firstTurnFixtures",
  );
  const flowFixtures = assertArray(fixture.flowFixtures, "flowFixtures");

  const firstTurnIds = validateFirstTurnFixtures(firstTurnFixtures);
  validateFlowFixtures(flowFixtures, firstTurnIds);

  console.log(
    `[writing-ppt-fixtures] ok firstTurn=${firstTurnFixtures.length} flows=${flowFixtures.length}`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    "[writing-ppt-fixtures] FAIL",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
