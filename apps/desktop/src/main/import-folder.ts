import { basename } from "node:path";
import { dialog } from "electron";

export type PickAndImportSuccess = {
  ok: true;
  projectId: string;
  name: string;
  pathSummary: string;
};

export type PickAndImportFailure = {
  ok: false;
  canceled?: boolean;
  message?: string;
};

export type PickAndImportResult = PickAndImportSuccess | PickAndImportFailure;

function companionBaseUrl(): string {
  return (process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477").replace(
    /\/$/,
    "",
  );
}

/**
 * 主进程选目录 → Companion import-folder；不向渲染进程返回 baseDir。
 */
export async function pickAndImportFolder(): Promise<PickAndImportResult> {
  const picked = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "选择课题目录",
  });
  if (picked.canceled || !picked.filePaths[0]) {
    return { ok: false, canceled: true };
  }

  const baseDir = picked.filePaths[0];
  const name = basename(baseDir);

  try {
    const res = await fetch(`${companionBaseUrl()}/v1/projects/import-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, baseDir }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      projectId?: string;
      name?: string;
      pathSummary?: string;
      error?: string;
    };
    if (!res.ok || !body.projectId) {
      return {
        ok: false,
        message: body.error ?? `import_failed_${res.status}`,
      };
    }
    return {
      ok: true,
      projectId: body.projectId,
      name: body.name ?? name,
      pathSummary: body.pathSummary ?? name,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message.includes("fetch failed")
            ? "无法连接 Companion，请先启动本机 Companion"
            : e.message
          : "import_failed",
    };
  }
}
