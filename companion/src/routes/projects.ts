import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { verifyDesktopImportToken } from "../desktop/secrets.js";
import {
  createProject,
  ensureDefaultTaskProject,
  ensureProject,
  getProject,
  importFolder,
  listProjects,
  resolveWorkspaceRoot,
  writeProjectUpload,
} from "../projects/store.js";
import {
  createProjectEntry,
  getProjectTree,
  getProjectTreeChildren,
  readProjectFile,
  resolveProjectMediaFile,
  writeProjectFile,
} from "../projects/tree.js";
import { listProjectFilePaths } from "../projects/files-index.js";
import type { WorkspaceKind } from "../types.js";

function isWorkspaceKind(v: string): v is WorkspaceKind {
  return v === "sandbox" || v === "local_bound" || v === "cloud";
}

type ByteRange =
  | { ok: true; partial: boolean; start: number; end: number }
  | { ok: false };

function parseByteRange(rangeHeader: string | string[] | undefined, size: number): ByteRange {
  if (size <= 0) return { ok: false };
  const header = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
  if (!header) return { ok: true, partial: false, start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { ok: false };
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return { ok: false };

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { ok: false };
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { ok: false };
  }

  return { ok: true, partial: true, start, end: Math.min(end, size - 1) };
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/projects", async () => {
    const projects = await listProjects();
    return { projects };
  });

  app.post<{
    Body: {
      projectId?: string;
      workspaceKind?: string;
      name?: string;
      baseDir?: string;
      bindingSource?: "user_picked" | "platform_default";
    };
  }>("/v1/projects/ensure", async (request, reply) => {
    const { projectId, workspaceKind, name, baseDir, bindingSource } =
      request.body ?? {};
    if (!projectId?.trim()) {
      return reply.code(400).send({ error: "project_id_required" });
    }
    if (!workspaceKind || !isWorkspaceKind(workspaceKind)) {
      return reply.code(400).send({ error: "invalid_workspace_kind" });
    }
    try {
      const project = await ensureProject({
        projectId: projectId.trim(),
        workspaceKind,
        name: name ?? "未命名项目",
        baseDir,
        bindingSource,
      });
      return { project };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Body: { name?: string; baseDir?: string };
  }>("/v1/projects/import-folder", async (request, reply) => {
    const { name, baseDir } = request.body ?? {};
    if (!baseDir?.trim()) {
      return reply.code(400).send({ error: "baseDir_required" });
    }

    // V1.1 D1.3：HMAC token 校验
    // - 缺 token：合法（浏览器路径），fromTrustedPicker=false
    // - 有 token 但无效：拒绝（401/403），不静默降级
    //   理由：发了 token 还失败说明配置错或被篡改，降级会掩盖问题
    const rawToken = request.headers["x-jlc-desktop-import-token"];
    const tokenStr = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    let fromTrustedPicker = false;
    if (typeof tokenStr === "string" && tokenStr.trim()) {
      const verdict = await verifyDesktopImportToken({
        token: tokenStr,
        baseDir,
      });
      if (!verdict.ok) {
        const status =
          verdict.code === "missing" || verdict.code === "malformed"
            ? 401
            : 403;
        return reply.code(status).send({
          error: "desktop_import_token_invalid",
          reason: verdict.code,
        });
      }
      fromTrustedPicker = true;
    }

    try {
      const project = await importFolder({
        name,
        baseDir,
        fromTrustedPicker,
      });
      return reply.code(201).send(project);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Body: { moduleId?: string; taskTitle?: string; taskId?: string };
  }>("/v1/projects/ensure-default-task-project", async (request, reply) => {
    const { moduleId, taskTitle, taskId } = request.body ?? {};
    if (!moduleId?.trim()) {
      return reply.code(400).send({ error: "module_id_required" });
    }
    try {
      const project = await ensureDefaultTaskProject({
        moduleId: moduleId.trim(),
        taskTitle,
        taskId,
      });
      return reply.code(201).send(project);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Body: { workspaceKind?: string; name?: string; baseDir?: string };
  }>("/v1/projects", async (request, reply) => {
    const { workspaceKind, name, baseDir } = request.body ?? {};
    if (!workspaceKind || !isWorkspaceKind(workspaceKind)) {
      return reply.code(400).send({ error: "invalid_workspace_kind" });
    }
    if (workspaceKind === "cloud") {
      return reply.code(400).send({ error: "cloud_not_supported_locally" });
    }
    if (workspaceKind === "local_bound") {
      return reply.code(400).send({
        error: "use_import_folder",
        message: "请使用 POST /v1/projects/import-folder 绑定本地目录",
      });
    }
    try {
      const project = await createProject({
        workspaceKind: "sandbox",
        name: name ?? "临时工作区",
        baseDir,
      });
      return reply.code(201).send(project);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get<{
    Params: { projectId: string };
    Querystring: { path?: string };
  }>("/v1/projects/:projectId/tree", async (request, reply) => {
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }
    const root = await resolveWorkspaceRoot(project.projectId);
    const relPath = (request.query.path ?? "").trim();
    if (relPath) {
      try {
        const nodes = await getProjectTreeChildren(root, relPath);
        return {
          projectId: project.projectId,
          root,
          path: relPath,
          nodes,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(400).send({ error: msg });
      }
    }
    const tree = await getProjectTree(root);
    return { projectId: project.projectId, root, tree };
  });

  app.get<{
    Params: { projectId: string };
    Querystring: { q?: string };
  }>("/v1/projects/:projectId/files-index", async (request, reply) => {
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }
    const root = await resolveWorkspaceRoot(project.projectId);
    const q = (request.query.q ?? "").trim();
    try {
      const files = await listProjectFilePaths(root, q || undefined);
      return { projectId: project.projectId, files, source: "rg_or_walk" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.get<{
    Params: { projectId: string };
    Querystring: { path?: string };
  }>("/v1/projects/:projectId/files", async (request, reply) => {
    const rel = request.query.path ?? "";
    if (!rel) return reply.code(400).send({ error: "path_required" });
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }
    try {
      const root = await resolveWorkspaceRoot(project.projectId);
      const file = await readProjectFile(root, rel);
      return file;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.get<{
    Params: { projectId: string };
    Querystring: { path?: string };
  }>("/v1/projects/:projectId/media", async (request, reply) => {
    const rel = request.query.path ?? "";
    if (!rel) return reply.code(400).send({ error: "path_required" });
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }

    try {
      const root = await resolveWorkspaceRoot(project.projectId);
      const media = await resolveProjectMediaFile(root, rel);
      const range = parseByteRange(request.headers.range, media.size);
      reply.header("Accept-Ranges", "bytes");
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Type", media.mime);

      if (!range.ok) {
        reply.header("Content-Range", `bytes */${media.size}`);
        return reply.code(416).send();
      }

      const stream = createReadStream(media.fullPath, {
        start: range.start,
        end: range.end,
      });
      const contentLength = range.end - range.start + 1;
      reply.header("Content-Length", String(contentLength));
      if (range.partial) {
        reply.header(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${media.size}`,
        );
        return reply.code(206).send(stream);
      }
      return reply.send(stream);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status =
        msg === "project_not_found"
          ? 404
          : msg === "unsupported_media_type"
            ? 415
            : 400;
      return reply.code(status).send({ error: msg });
    }
  });

  app.put<{
    Params: { projectId: string };
    Body: {
      path?: string;
      content?: string;
      encoding?: "utf8" | "base64";
    };
  }>("/v1/projects/:projectId/files", async (request, reply) => {
    const { path, content, encoding } = request.body ?? {};
    if (!path?.trim()) return reply.code(400).send({ error: "path_required" });
    if (typeof content !== "string") {
      return reply.code(400).send({ error: "content_required" });
    }
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }
    try {
      const root = await resolveWorkspaceRoot(project.projectId);
      const written = await writeProjectFile({
        projectRoot: root,
        relPath: path.trim(),
        content,
        encoding: encoding === "base64" ? "base64" : "utf8",
      });
      return {
        projectId: project.projectId,
        path: written.path,
        mime: written.mime,
        size: written.size,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      type?: "file" | "folder";
      path?: string;
      content?: string;
    };
  }>("/v1/projects/:projectId/entries", async (request, reply) => {
    const { type, path, content } = request.body ?? {};
    if (type !== "file" && type !== "folder") {
      return reply.code(400).send({ error: "invalid_entry_type" });
    }
    if (!path?.trim()) return reply.code(400).send({ error: "path_required" });
    const project = await getProject(request.params.projectId);
    if (!project) {
      return reply.code(404).send({ error: "project_not_found" });
    }
    try {
      const root = await resolveWorkspaceRoot(project.projectId);
      const entry = await createProjectEntry({
        projectRoot: root,
        relPath: path.trim(),
        type,
        content,
      });
      return {
        projectId: project.projectId,
        ...entry,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(400).send({ error: msg });
    }
  });

  app.post<{
    Params: { projectId: string };
    Body: { name?: string; contentBase64?: string };
  }>("/v1/projects/:projectId/uploads", async (request, reply) => {
    const { name, contentBase64 } = request.body ?? {};
    if (!name?.trim()) {
      return reply.code(400).send({ error: "name_required" });
    }
    if (typeof contentBase64 !== "string" || !contentBase64) {
      return reply.code(400).send({ error: "content_base64_required" });
    }

    try {
      const bytes = Buffer.from(contentBase64, "base64");
      if (bytes.length === 0) {
        return reply.code(400).send({ error: "empty_upload" });
      }
      const written = await writeProjectUpload({
        workspaceProjectId: request.params.projectId,
        filename: name,
        bytes,
      });
      return {
        projectId: request.params.projectId,
        path: written.path,
        size: written.size,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = msg === "project_not_found" ? 404 : 400;
      return reply.code(status).send({ error: msg });
    }
  });
}
