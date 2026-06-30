import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  loadChatCatalog,
  loadSkill,
  loadSkillBundle,
  verifyChatCatalog,
} from "../packages/runtime-core/dist/index.js";

const requiredSkills = [
  "skill-industrial-drawing-base",
  "skill-industrial-drawing-parametric",
  "skill-industrial-drawing-export",
];

const requiredReferences = {
  "skill-industrial-drawing-base": [
    "cadam-alignment-checklist.md",
    "cadam-core-flow.md",
    "questionnaire-protocol.md",
  ],
  "skill-industrial-drawing-parametric": [
    "openscad-authoring-standard.md",
  ],
  "skill-industrial-drawing-export": [
    "openscad-toolchain.md",
    "export-quality-checklist.md",
  ],
};

const requiredNeedles = {
  "skill-industrial-drawing-base": [
    "CADAM",
    "3d_requirement_summary",
    "3d_outline",
    "drawing.scad",
    "drawing.parameters.json",
    "OpenSCAD",
  ],
  "skill-industrial-drawing-parametric": [
    "OpenSCAD",
    "Customizer",
    "drawing.scad",
    "drawing.parameters.json",
  ],
  "skill-industrial-drawing-export": [
    "OpenSCAD",
    "DXF",
    "STL",
    "fallback",
    "drawing.parameters.json",
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function relativeReferenceNames(skill) {
  return skill.referencePaths.map((path) => basename(path));
}

const catalogCheck = verifyChatCatalog();
assert(
  catalogCheck.ok,
  `chat catalog has missing skills: ${catalogCheck.missingSlugs.join(", ")}`,
);

const catalog = loadChatCatalog();
const catalogSlugs = new Set(catalog.entries.map((entry) => entry.slug));
for (const slug of requiredSkills) {
  assert(catalogSlugs.has(slug), `${slug} is not visible in chat catalog`);
}

for (const slug of requiredSkills) {
  const skill = loadSkill(slug);
  assert(skill, `${slug} is missing`);

  const refNames = new Set(relativeReferenceNames(skill));
  for (const ref of requiredReferences[slug]) {
    assert(refNames.has(ref), `${slug} missing reference ${ref}`);
  }

  const body = skill.body;
  for (const needle of requiredNeedles[slug]) {
    assert(body.includes(needle), `${slug} missing required contract: ${needle}`);
  }

  for (const refPath of skill.referencePaths) {
    const text = readFileSync(refPath, "utf8");
    assert(text.trim().length > 200, `${refPath} looks too short`);
  }
}

const bundle = loadSkillBundle({
  processSkill: "skill-industrial-drawing-base",
  platformNormSkill: "skill-platform-research-norms",
});
assert(
  bundle.missing.length === 0,
  `3D skill bundle missing: ${bundle.missing.join(", ")}`,
);
assert(
  bundle.process?.slug === "skill-industrial-drawing-base",
  "3D base skill did not load as process skill",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      skills: requiredSkills.map((slug) => {
        const skill = loadSkill(slug);
        return {
          slug,
          references: skill?.referencePaths.length ?? 0,
        };
      }),
      catalogVisible: requiredSkills.length,
    },
    null,
    2,
  ),
);
