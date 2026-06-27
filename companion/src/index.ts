import { config, PACKAGE_VERSION } from "./config.js";
import { startServer } from "./server.js";
import { ensureDefaultSandbox } from "./projects/store.js";

async function main() {
  await ensureDefaultSandbox();
  const app = await startServer();
  console.log(
    `[companion] v${PACKAGE_VERSION} listening on http://${config.host}:${config.port}`,
  );
  console.log(`[companion] dataDir=${config.dataDir} runMode=${config.runMode}`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[companion] fatal", err);
  process.exit(1);
});
