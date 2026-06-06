import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import path from "node:path"
import { createTempProject, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import { useActivityStore } from "@/stores/activity-store"
import { useChatStore } from "@/stores/chat-store"
import { useReviewStore } from "@/stores/review-store"
import { useWikiStore } from "@/stores/wiki-store"
import { sourceSummarySlugFromIdentity } from "./source-identity"

vi.mock("@/commands/fs", () => realFs)

let sourceMarkers: string[] = []

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(async (_cfg, messages, cb) => {
    const systemPrompt = String(messages?.[0]?.content ?? "")
    const userPrompt = String(messages?.[1]?.content ?? "")

    if (systemPrompt.startsWith("You are merging two versions")) {
      const incoming = userPrompt.split("## Newly generated version")[1]?.split("---")[2]
      cb.onToken(incoming?.trim() || "---\ntitle: merged\n---\n\n# merged")
      cb.onDone()
      return
    }

    if (systemPrompt.startsWith("You are a wiki generation assistant")) {
      cb.onToken([
        "---FILE: wiki/sources/config.md---",
        "---",
        'type: "source"',
        'title: "Source: config.yaml"',
        'sources: ["config.yaml"]',
        "tags: []",
        "related: []",
        "---",
        "",
        "# Source: config.yaml",
        "",
        "Configuration source generated from the chat handoff.",
        "---END FILE---",
      ].join("\n"))
      cb.onDone()
      return
    }

    const targetMatch = systemPrompt.match(
      /source summary page at \*\*(wiki\/sources\/[^*]+)\*\*/,
    )
    if (!targetMatch) {
      cb.onToken("## Analysis\nConfiguration source.")
      cb.onDone()
      return
    }

    const marker = sourceMarkers.shift() ?? "unknown project"
    const targetPath = targetMatch[1]
    const sourceIdentity =
      systemPrompt.match(/original source file is:\s*\*\*([^*]+)\*\*/i)?.[1] ?? "config.yaml"
    cb.onToken([
      `---FILE: ${targetPath}---`,
      "---",
      `title: "Source: ${sourceIdentity}"`,
      `sources: ["${sourceIdentity}"]`,
      "---",
      "",
      `# ${marker}`,
      "",
      `Configuration details for ${marker}.`,
      "---END FILE---",
    ].join("\n"))
    cb.onDone()
  }),
}))

import { autoIngest, executeIngestWrites } from "./ingest"

describe("autoIngest source summary paths", () => {
  let tmp: { path: string; cleanup: () => Promise<void> } | undefined

  beforeEach(async () => {
    sourceMarkers = []
    tmp = await createTempProject("same-basename-sources")

    await writeFileRaw(`${tmp.path}/purpose.md`, "# Purpose\n\nTrack project config files.\n")
    await writeFileRaw(
      `${tmp.path}/schema.md`,
      "# Schema\n\nEach source needs its own source summary page.\n",
    )
    await writeFileRaw(`${tmp.path}/wiki/index.md`, "# Index\n")
    await writeFileRaw(`${tmp.path}/wiki/overview.md`, "# Overview\n")
    await writeFileRaw(`${tmp.path}/raw/sources/project-a/config.yaml`, "name: alpha\n")
    await writeFileRaw(`${tmp.path}/raw/sources/project-b/config.yaml`, "name: beta\n")

    useReviewStore.setState({ items: [] })
    useActivityStore.setState({ items: [] })
    useChatStore.setState({
      conversations: [],
      messages: [],
      activeConversationId: null,
      mode: "chat",
      ingestSource: null,
      isStreaming: false,
      streamingContent: "",
    })
    useWikiStore.setState({
      project: {
        id: "same-basename-sources",
        name: "same-basename-sources",
        path: tmp.path,
      },
      fileTree: [],
      outputLanguage: "auto",
      multimodalConfig: {
        enabled: false,
        useMainLlm: true,
        provider: "openai",
        apiKey: "",
        model: "",
        ollamaUrl: "",
        customEndpoint: "",
        concurrency: 1,
      },
      embeddingConfig: {
        enabled: false,
        endpoint: "",
        apiKey: "",
        model: "",
      },
    })
  })

  afterEach(async () => {
    await tmp?.cleanup()
    tmp = undefined
  })

  it("keeps distinct source summaries for same-basename files in different source subdirectories", async () => {
    if (!tmp) throw new Error("missing temp project")
    sourceMarkers = ["project-a config", "project-b config"]

    await autoIngest(
      tmp.path,
      `${tmp.path}/raw/sources/project-a/config.yaml`,
      useWikiStore.getState().llmConfig,
      undefined,
      "project-a",
    )
    await autoIngest(
      tmp.path,
      `${tmp.path}/raw/sources/project-b/config.yaml`,
      useWikiStore.getState().llmConfig,
      undefined,
      "project-b",
    )

    const sourcesDir = path.join(tmp.path, "wiki", "sources")
    const summaryFiles = (await fs.readdir(sourcesDir))
      .filter((name) => name.endsWith(".md"))
      .sort()
    const summaryContents = await Promise.all(
      summaryFiles.map((name) => fs.readFile(path.join(sourcesDir, name), "utf8")),
    )
    const allSummaries = summaryContents.join("\n\n--- summary boundary ---\n\n")

    expect(summaryFiles).toHaveLength(2)
    expect(allSummaries).toContain("project-a/config.yaml")
    expect(allSummaries).toContain("project-b/config.yaml")
  })

  it("migrates a safe legacy basename source summary to the canonical nested source path", async () => {
    if (!tmp) throw new Error("missing temp project")
    sourceMarkers = ["project-a config"]
    await fs.rm(path.join(tmp.path, "raw", "sources", "project-b", "config.yaml"))

    const legacySummaryPath = path.join(tmp.path, "wiki", "sources", "config.md")
    await writeFileRaw(
      legacySummaryPath,
      [
        "---",
        'title: "Source: config.yaml"',
        'sources: ["config.yaml"]',
        "---",
        "",
        "# Legacy config",
        "",
        "Legacy source summary body.",
      ].join("\n"),
    )

    await autoIngest(
      tmp.path,
      `${tmp.path}/raw/sources/project-a/config.yaml`,
      useWikiStore.getState().llmConfig,
      undefined,
      "project-a",
    )

    const canonicalSummary = `wiki/sources/${sourceSummarySlugFromIdentity("project-a/config.yaml")}.md`
    const canonicalSummaryPath = path.join(tmp.path, canonicalSummary)
    const content = await fs.readFile(canonicalSummaryPath, "utf8")

    await expect(fs.access(legacySummaryPath)).rejects.toThrow()
    expect(content).toContain('sources: ["project-a/config.yaml"]')
    expect(content).toContain("project-a config")
  })

  it("does not migrate a legacy basename source summary when the basename is ambiguous", async () => {
    if (!tmp) throw new Error("missing temp project")
    sourceMarkers = ["project-a config"]

    const legacySummaryPath = path.join(tmp.path, "wiki", "sources", "config.md")
    const legacyContent = [
      "---",
      'title: "Source: config.yaml"',
      'sources: ["config.yaml"]',
      "---",
      "",
      "# Legacy config",
      "",
      "Ambiguous legacy source summary body.",
    ].join("\n")
    await writeFileRaw(legacySummaryPath, legacyContent)

    await autoIngest(
      tmp.path,
      `${tmp.path}/raw/sources/project-a/config.yaml`,
      useWikiStore.getState().llmConfig,
      undefined,
      "project-a",
    )

    const canonicalSummary = `wiki/sources/${sourceSummarySlugFromIdentity("project-a/config.yaml")}.md`
    const canonicalSummaryPath = path.join(tmp.path, canonicalSummary)

    expect(await fs.readFile(legacySummaryPath, "utf8")).toBe(legacyContent)
    expect(await fs.readFile(canonicalSummaryPath, "utf8")).toContain("project-a config")
  })

  it("canonicalizes interactive source summary paths and sources frontmatter", async () => {
    if (!tmp) throw new Error("missing temp project")

    const conversationId = "conv-interactive-source"
    useChatStore.setState({
      activeConversationId: conversationId,
      conversations: [
        {
          id: conversationId,
          title: "Interactive source summary",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      ingestSource: `${tmp.path}/raw/sources/project-a/config.yaml`,
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Please save the source summary.",
          timestamp: Date.now(),
          conversationId,
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Ready to create the source summary.",
          timestamp: Date.now(),
          conversationId,
        },
      ],
    })

    const writtenPaths = await executeIngestWrites(
      tmp.path,
      useWikiStore.getState().llmConfig,
    )

    const canonicalSummary = `wiki/sources/${sourceSummarySlugFromIdentity("project-a/config.yaml")}.md`
    const canonicalSummaryPath = path.join(tmp.path, canonicalSummary)
    const staleSummaryPath = path.join(tmp.path, "wiki", "sources", "config.md")
    const content = await fs.readFile(canonicalSummaryPath, "utf8")

    expect(writtenPaths).toEqual([canonicalSummaryPath])
    await expect(fs.access(staleSummaryPath)).rejects.toThrow()
    expect(content).toContain('sources: ["project-a/config.yaml"]')
  })
})
