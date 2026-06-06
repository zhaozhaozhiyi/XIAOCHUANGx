import { describe, expect, it } from "vitest"
import type { LintResult } from "@/lib/lint"
import { groupLintResultsForDisplay } from "./lint-view"

function lintResult(
  page: string,
  severity: LintResult["severity"],
): LintResult {
  return {
    type: severity === "warning" ? "broken-link" : "orphan",
    severity,
    page,
    detail: `${page} detail`,
  }
}

describe("groupLintResultsForDisplay", () => {
  it("keeps original result indices when warnings and infos are interleaved", () => {
    const results = [
      lintResult("info-a.md", "info"),
      lintResult("warning-b.md", "warning"),
      lintResult("info-c.md", "info"),
      lintResult("warning-d.md", "warning"),
    ]

    const grouped = groupLintResultsForDisplay(results)

    expect(grouped.warnings.map(({ index, result }) => [index, result.page])).toEqual([
      [1, "warning-b.md"],
      [3, "warning-d.md"],
    ])
    expect(grouped.infos.map(({ index, result }) => [index, result.page])).toEqual([
      [0, "info-a.md"],
      [2, "info-c.md"],
    ])
  })
})
