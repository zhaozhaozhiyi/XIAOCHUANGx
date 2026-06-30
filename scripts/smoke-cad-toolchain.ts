import { probeOpenScadToolchain } from "../web/src/lib/cad-toolchain.ts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const openscad = await probeOpenScadToolchain();
  if (openscad.binary !== "openscad") {
    throw new Error("Unexpected CAD toolchain binary");
  }
  if (typeof openscad.available !== "boolean") {
    throw new Error("CAD toolchain availability is missing");
  }
  if ("path" in openscad) {
    throw new Error("CAD toolchain status must not expose executable path");
  }
  if (typeof openscad.licenseNotices?.available !== "boolean") {
    throw new Error("CAD toolchain license notices status is missing");
  }
  if (!openscad.available && !openscad.licenseNotices.reason) {
    throw new Error("Unavailable OpenSCAD runtime should expose a license/runtime reason");
  }
  if (openscad.licenseNotices.available && openscad.licenseNotices.reason) {
    throw new Error("Available license notices should not expose an error reason");
  }
  const preparedRuntime =
    existsSync(resolve("../apps/desktop/resources/engines/openscad/darwin/RUNTIME_MANIFEST.json")) ||
    existsSync(resolve("../apps/desktop/resources/engines/openscad/darwin/OpenSCAD.app")) ||
    existsSync(resolve("apps/desktop/resources/engines/openscad/darwin/RUNTIME_MANIFEST.json")) ||
    existsSync(resolve("apps/desktop/resources/engines/openscad/darwin/OpenSCAD.app"));
  if (preparedRuntime && !openscad.available) {
    throw new Error(
      `Prepared OpenSCAD runtime exists but toolchain is unavailable: ${openscad.reason}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        openscad,
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
