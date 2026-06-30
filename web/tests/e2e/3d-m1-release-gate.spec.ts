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
});
