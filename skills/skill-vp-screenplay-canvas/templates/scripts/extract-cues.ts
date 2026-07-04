import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const SCORE_PATH = resolve(ROOT, "src/runtime/score.ts");
const SEQUENCES_DIR = resolve(ROOT, "src/sequences");
const OUT_PATH = resolve(ROOT, "audio-cues.json");

interface CueItem {
  sequence: string;
  beat: number;
  text: string;
  audio: string;
}

async function readSequenceOrder(): Promise<{ id: string; folder: string }[]> {
  const src = await readFile(SCORE_PATH, "utf8");
  const ids = [...src.matchAll(/id:\s*["']([^"']+)["']/g)].map((m) => m[1]!);
  const folders = [...src.matchAll(/from\s+["']\.\.\/sequences\/([^"'\/]+)\/cues["']/g)].map(
    (m) => m[1]!,
  );

  return ids.map((id) => {
    const folder =
      folders.find((item) => item.endsWith(`-${id}`)) ??
      folders.find((item) => item === id);
    if (!folder) throw new Error(`No cues.ts folder found for sequence "${id}"`);
    return { id, folder };
  });
}

async function loadCues(folder: string): Promise<string[]> {
  const file = join(SEQUENCES_DIR, folder, "cues.ts");
  if (!existsSync(file)) throw new Error(`missing cues.ts: ${file}`);
  const mod = await import(pathToFileURL(file).href);
  if (!Array.isArray(mod.cues)) {
    throw new Error(`cues.ts in ${folder} must export "cues" array`);
  }
  return mod.cues;
}

async function main() {
  const order = await readSequenceOrder();
  const items: CueItem[] = [];

  for (const { id, folder } of order) {
    const cues = await loadCues(folder);
    cues.forEach((text, idx) => {
      if (typeof text !== "string") {
        throw new Error(`sequence "${id}" beat ${idx + 1}: cue must be string`);
      }
      if (text.trim() === "") return;
      const beat = idx + 1;
      items.push({
        sequence: id,
        beat,
        text,
        audio: `${id}/${beat}.mp3`,
      });
    });
  }

  await writeFile(OUT_PATH, JSON.stringify(items, null, 2) + "\n", "utf8");
  console.error(`wrote ${items.length} cues -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
