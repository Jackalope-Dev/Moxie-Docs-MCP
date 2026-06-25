import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MOXIE_MCP_ENDPOINT,
  MOXIE_SITE_URL,
  MOXIE_SKILL_PATHS,
  moxieDocsSkillMarkdown,
  renderAgentsGuidanceBlock,
  renderSkillMarkdown,
} from "./skill";

describe("renderSkillMarkdown", () => {
  it("inlines the repository slug and frontmatter name", () => {
    const markdown = renderSkillMarkdown({ repository: "acme/app" });
    expect(markdown).toContain("acme/app");
    expect(markdown).toContain("name: moxie-docs");
  });
});

describe("renderAgentsGuidanceBlock", () => {
  it("renders marker-free guidance text", () => {
    const block = renderAgentsGuidanceBlock({ repository: "acme/app" });
    expect(block).toContain("Moxie Docs Agent Guidance");
    expect(block).toContain("acme/app");
    expect(block).not.toContain("<!--");
  });
});

describe("constants", () => {
  it("exposes the endpoint and site URLs", () => {
    expect(MOXIE_MCP_ENDPOINT).toBe("https://moxiedocs.com/api/mcp");
    expect(MOXIE_SITE_URL).toBe("https://moxiedocs.com");
    expect(MOXIE_SKILL_PATHS.length).toBeGreaterThan(0);
  });
});

describe("moxieDocsSkillMarkdown", () => {
  it("equals the bytes of the shipped SKILL.md", () => {
    const skillPath = fileURLToPath(
      new URL("../../skills/moxie-docs/SKILL.md", import.meta.url),
    );
    const fileContents = readFileSync(skillPath, "utf8");
    expect(moxieDocsSkillMarkdown).toBe(fileContents);
  });
});
