import { app } from "electron";
import { startEmbeddedWebServer } from "./embedded-web.js";

/**
 * 解析渲染进程应加载的 Web 地址（PRD §5.3.7）：
 * - 显式 JLC_WEB_URL 优先
 * - 打包态：内嵌 Next standalone
 * - 开发态：默认 localhost:3000（需另启 pnpm dev:web）
 */
export async function resolveWebAppUrl(): Promise<string> {
  const override = process.env.JLC_WEB_URL?.trim();
  if (override) return override;

  if (app.isPackaged && process.env.JLC_DESKTOP_DEV !== "1") {
    const embedded = await startEmbeddedWebServer();
    if (embedded) return embedded;
    throw new Error(
      "打包应用未找到内嵌 Web 资源，请重新执行 desktop:pack 或设置 JLC_WEB_URL",
    );
  }

  return "http://localhost:3000";
}
