import { readFile } from "node:fs/promises";
import {
  parseScadParameters,
  updateScadParameters,
} from "../web/src/lib/scad-parameters.ts";

async function main(): Promise<void> {
  const source = await readFile(
    new URL("../参考项目/CADAM/benchmarks/04-honeycomb-bracket.scad", import.meta.url),
    "utf8",
  );

  const parameters = parseScadParameters(source);
  const target = parameters.find((parameter) => parameter.type === "number");

  if (!target) {
    throw new Error("No numeric SCAD parameter parsed");
  }

  const nextValue = Number(target.value) + 1;
  target.value = nextValue;
  const nextSource = updateScadParameters(source, [target]);
  const escapedName = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const updated = new RegExp(`${escapedName}\\s*=\\s*${nextValue};`).test(
    nextSource,
  );

  if (!updated) {
    throw new Error(`Parameter ${target.name} was not updated`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        count: parameters.length,
        changed: target.name,
        value: nextValue,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
