import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

const SCAD_SOURCE = `
module bracket(width = 18, depth = 12, height = 8) {
  difference() {
    cube([width, depth, height], center = true);
    translate([0, 0, 1]) cube([width - 6, depth - 4, height], center = true);
  }
}
bracket();
`;

const PARAMETRIC_SCAD_SOURCE = `
width = 18; // [10:1:40]
depth = 12; // [8:1:30]
height = 8; // [4:1:20]

module bracket() {
  difference() {
    cube([width, depth, height], center = true);
    translate([0, 0, 1]) cube([width - 6, depth - 4, height], center = true);
  }
}
bracket();
`;

const PREVIEW_STL_BASE64 = Buffer.from(
  [
    "solid fallback",
    "facet normal 0 0 1",
    "outer loop",
    "vertex 0 0 0",
    "vertex 1 0 0",
    "vertex 0 1 0",
    "endloop",
    "endfacet",
    "endsolid fallback",
  ].join("\n"),
  "utf8",
).toString("base64");

test.describe("3D M1 release gate", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test("renders SCAD preview through browser OpenSCAD WASM", async ({
    page,
  }) => {
    const sessionId = "3d-m1-wasm-ui";
    const projectId = "proj-3d-m1-gate";
    const scadPath = "models/bracket.scad";

    await page.route(`**/api/projects/${projectId}/tree**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId,
          mode: "mock",
          root: null,
          rootNode: {
            id: "root",
            name: "3D M1 Gate",
            type: "folder",
            children: [
              {
                id: "models",
                name: "models",
                type: "folder",
                relativePath: "models",
                children: [
                  {
                    id: "models/bracket.scad",
                    name: "bracket.scad",
                    type: "file",
                    relativePath: scadPath,
                    language: "scad",
                  },
                ],
              },
            ],
          },
          label: "3D M1 Gate",
        }),
      });
    });

    await page.route("**/api/workspace/file?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("path") !== scadPath) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "file not found" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          path: scadPath,
          projectId,
          content: SCAD_SOURCE,
          encoding: "utf8",
        }),
      });
    });

    await page.route("**/api/workspace/cad/toolchain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          openscad: {
            available: false,
            reason: "runtime_missing",
            licenseNotices: { available: false, reason: "runtime_missing" },
          },
          capabilities: {
            scadToStl: false,
            scadToDxfProjection: false,
            previewStlFallback: true,
            parameterOutlineDxfFallback: true,
          },
        }),
      });
    });

    await page.route("**/api/workspace/cad/compile?**", async (route) => {
      await route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({
          error: "openscad_unavailable",
          detail: "CLI runtime intentionally absent in WASM UI gate.",
        }),
      });
    });

    await page.addInitScript(
      ([seedSessionId, seedProjectId]) => {
        window.localStorage.setItem(
          `jlc-chat-messages-${seedSessionId}`,
          JSON.stringify([
            {
              id: `${seedSessionId}-user`,
              role: "user",
              content: "生成一个参数化支架",
              status: "complete",
            },
            {
              id: `${seedSessionId}-assistant`,
              role: "assistant",
              content: "已生成 SCAD 主文件。",
              status: "complete",
            },
          ]),
        );
        window.localStorage.setItem(
          `jlc-chat-project-${seedSessionId}`,
          seedProjectId,
        );
      },
      [sessionId, projectId],
    );

    await page.goto(`/3d/${sessionId}`);
    await page.evaluate((path) => {
      window.dispatchEvent(
        new CustomEvent("jlc-open-workspace-file", {
          detail: { path },
        }),
      );
    }, scadPath);

    await expect(
      page.getByText("预览来源：浏览器 OpenSCAD WASM 快速预览"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("opens the editable SCAD workbench from a 3D deliverables action", async ({
    page,
  }) => {
    const sessionId = "3d-m1-deliverables-action";
    const projectId = "proj-3d-m1-deliverables";
    const scadPath = "drawing.scad";

    await page.route(`**/api/projects/${projectId}/tree**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId,
          mode: "mock",
          root: null,
          rootNode: {
            id: "root",
            name: "3D Deliverables Gate",
            type: "folder",
            children: [
              {
                id: "README.md",
                name: "README.md",
                type: "file",
                relativePath: "README.md",
                language: "markdown",
              },
              {
                id: scadPath,
                name: "drawing.scad",
                type: "file",
                relativePath: scadPath,
                language: "scad",
              },
              {
                id: "exports",
                name: "exports",
                type: "folder",
                relativePath: "exports",
                children: [
                  {
                    id: "exports/preview.stl",
                    name: "preview.stl",
                    type: "file",
                    relativePath: "exports/preview.stl",
                    language: "stl",
                  },
                ],
              },
            ],
          },
          label: "3D Deliverables Gate",
        }),
      });
    });

    await page.route("**/api/workspace/file?**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get("path");
      if (path === scadPath) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            path: scadPath,
            projectId,
            content: PARAMETRIC_SCAD_SOURCE,
            encoding: "utf8",
          }),
        });
        return;
      }
      if (path === "exports/preview.stl") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            path,
            projectId,
            content: PREVIEW_STL_BASE64,
            encoding: "base64",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "file not found" }),
      });
    });

    await page.route("**/api/workspace/cad/toolchain", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          openscad: {
            available: false,
            reason: "runtime_missing",
            licenseNotices: { available: false, reason: "runtime_missing" },
          },
          capabilities: {
            scadToStl: false,
            scadToDxfProjection: false,
            previewStlFallback: true,
            parameterOutlineDxfFallback: true,
          },
        }),
      });
    });

    await page.route("**/api/workspace/cad/compile?**", async (route) => {
      await route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({
          error: "openscad_unavailable",
          detail: "CLI runtime intentionally absent in deliverables gate.",
        }),
      });
    });

    await page.addInitScript(
      ([seedSessionId, seedProjectId]) => {
        const deliverables = {
          id: "deliverables-3d",
          kind: "deliverables",
          zone: "summary",
          headline: "本轮交付文件如下：",
          primaryPath: "exports/preview.stl",
          workspaceProjectId: seedProjectId,
          items: [
            {
              path: "exports/preview.stl",
              label: "preview.stl",
              mime: "model/stl",
              kind: "primary",
            },
            {
              path: "drawing.scad",
              label: "drawing.scad",
              mime: "text/x-openscad",
              kind: "attachment",
            },
            {
              path: "README.md",
              label: "README.md",
              mime: "text/markdown",
              kind: "attachment",
            },
          ],
          manifest: {
            version: 1,
            moduleId: "3d",
            runId: "run-3d-m1-deliverables",
            sessionId: seedSessionId,
            projectId: seedProjectId,
            title: "参数化支架",
            status: "ready",
            stage: "preview",
            primaryArtifact: {
              id: "artifact-preview-stl",
              type: "stl",
              label: "preview.stl",
              path: "exports/preview.stl",
              role: "primary",
              mimeType: "model/stl",
            },
            artifacts: [
              {
                id: "artifact-readme",
                type: "md",
                label: "README.md",
                path: "README.md",
                role: "preview",
                mimeType: "text/markdown",
              },
              {
                id: "artifact-preview-stl",
                type: "stl",
                label: "preview.stl",
                path: "exports/preview.stl",
                role: "primary",
                mimeType: "model/stl",
              },
              {
                id: "artifact-drawing-scad",
                type: "scad",
                label: "drawing.scad",
                path: "drawing.scad",
                role: "source",
                mimeType: "text/x-openscad",
              },
            ],
            previews: [
              {
                id: "preview-readme",
                type: "document",
                label: "打开预览",
                path: "README.md",
                status: "available",
              },
              {
                id: "preview-stl",
                type: "model",
                label: "STL 预览",
                path: "exports/preview.stl",
                status: "available",
              },
            ],
            generatedFormats: [],
            availableConversions: [],
            actions: [
              {
                id: "open_preview",
                label: "打开模型预览",
                kind: "preview",
                targetArtifactId: "artifact-preview-stl",
                enabled: true,
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };

        window.localStorage.setItem(
          `jlc-chat-messages-${seedSessionId}`,
          JSON.stringify([
            {
              id: `${seedSessionId}-user`,
              role: "user",
              content: "生成一个参数化支架",
              status: "complete",
            },
            {
              id: `${seedSessionId}-assistant`,
              role: "assistant",
              content: "已生成 SCAD 主文件。",
              status: "complete",
              activityCollapse: "collapsed",
              parts: [deliverables],
            },
          ]),
        );
        window.localStorage.setItem(
          `jlc-chat-project-${seedSessionId}`,
          seedProjectId,
        );
      },
      [sessionId, projectId],
    );

    await page.goto(`/3d/${sessionId}`);
    await page.getByRole("button", { name: "打开模型预览" }).click();

    await expect(page.getByText("drawing.scad").first()).toBeVisible();
    await expect(page.getByText("参数面板")).toBeVisible();
    await expect(
      page.getByText("预览来源：浏览器 OpenSCAD WASM 快速预览"),
    ).toBeVisible({ timeout: 30_000 });
  });
});
