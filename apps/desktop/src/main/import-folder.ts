import { basename } from "node:path";
import { dialog } from "electron";
import { getCompanionRegistrar } from "./companion-register.js";

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

function projectImportErrorMessage(code: string): string {
  switch (code) {
    case "baseDir_not_accessible":
      return "目录不存在或无法读取，请检查路径是否正确";
    case "baseDir_must_be_under_home":
      return "目录须位于用户主目录下";
    case "baseDir_forbidden":
      return "不能绑定系统目录";
    case "baseDir_in_data_dir":
      return "不能绑定 Companion 数据目录，请选择您的课题目录";
    case "baseDir_required":
      return "请填写文件夹路径";
    case "desktop_import_token_invalid":
      // 桌面壳与 Companion 之间的 HMAC 凭证失效 / 不一致 —— 通常是 secrets
      // 文件被改动或时钟严重偏差。提示用户重启可让桌面壳重新 register。
      return "桌面壳与 Companion 凭证不匹配，请重启小窗后再试";
    default:
      return code;
  }
}

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

  // V1.1 D1.3：带 HMAC token；register 没就绪时不阻塞，走无 token 路径
  // （Companion 侧把它当作浏览器请求处理，仍要求 baseDir 在 home 下）
  const token = await getCompanionRegistrar()
    .signImportToken({ baseDir })
    .catch((err: unknown) => {
      console.warn("[desktop] sign import token failed:", err);
      return null;
    });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-JLC-Desktop-Import-Token"] = token;

  try {
    const res = await fetch(`${companionBaseUrl()}/v1/projects/import-folder`, {
      method: "POST",
      headers,
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
        message: projectImportErrorMessage(
          body.error ?? `import_failed_${res.status}`,
        ),
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
