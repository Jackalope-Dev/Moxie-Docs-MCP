import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CorruptMarkersError,
  installAgentsBlock,
  installSkill,
  parseRepositorySlug,
  REPO_PLACEHOLDER,
} from "./skills-install";
import { MOXIE_SKILL_PATHS } from "../interface/skill";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "moxie-skill-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("parseRepositorySlug", () => {
  it("parses an HTTPS remote", () => {
    expect(parseRepositorySlug("https://github.com/acme/app.git")).toBe(
      "acme/app",
    );
  });
  it("parses an SSH remote", () => {
    expect(parseRepositorySlug("git@github.com:acme/app.git")).toBe("acme/app");
  });
  it("parses without .git suffix", () => {
    expect(parseRepositorySlug("https://github.com/acme/app")).toBe("acme/app");
  });
  it("returns null for an unparseable value", () => {
    expect(parseRepositorySlug("")).toBeNull();
    expect(parseRepositorySlug("not-a-remote")).toBeNull();
  });
});

describe("installSkill", () => {
  it("writes both SKILL.md paths with the repo slug substituted", () => {
    const { paths } = installSkill(cwd, { repository: "acme/app" });
    expect(paths).toEqual(MOXIE_SKILL_PATHS.map((p) => join(cwd, p)));
    for (const p of paths) {
      const content = readFileSync(p, "utf8");
      expect(content).toContain("acme/app");
      expect(content).toContain("name: moxie-docs");
    }
  });

  it("uses the placeholder slug when none is detected", () => {
    const { paths } = installSkill(cwd, { repository: REPO_PLACEHOLDER });
    const content = readFileSync(paths[0] as string, "utf8");
    expect(content).toContain(REPO_PLACEHOLDER);
  });
});

describe("installAgentsBlock", () => {
  it("creates AGENTS.md with a header + markers when absent", () => {
    const result = installAgentsBlock(cwd, { repository: "acme/app" });
    expect(result.action).toBe("created");
    const content = readFileSync(result.path, "utf8");
    expect(content).toContain("# Repository Instructions");
    expect(content).toContain("<!-- moxie-docs:start -->");
    expect(content).toContain("<!-- moxie-docs:end -->");
    expect(content).toContain("acme/app");
  });

  it("appends a block when the file has no markers, preserving content", () => {
    const file = join(cwd, "AGENTS.md");
    writeFileSync(file, "# My Rules\n\nUse tabs.\n", "utf8");
    const result = installAgentsBlock(cwd, { repository: "acme/app" });
    expect(result.action).toBe("updated");
    const content = readFileSync(file, "utf8");
    expect(content).toContain("# My Rules");
    expect(content).toContain("Use tabs.");
    expect(content).toContain("<!-- moxie-docs:start -->");
  });

  it("replaces only between markers, preserving surrounding text", () => {
    const file = join(cwd, "AGENTS.md");
    writeFileSync(
      file,
      [
        "# Top",
        "",
        "Before text.",
        "",
        "<!-- moxie-docs:start -->",
        "OLD GUIDANCE for old/repo",
        "<!-- moxie-docs:end -->",
        "",
        "After text.",
        "",
      ].join("\n"),
      "utf8",
    );
    const result = installAgentsBlock(cwd, { repository: "new/repo" });
    expect(result.action).toBe("updated");
    const content = readFileSync(file, "utf8");
    expect(content).toContain("Before text.");
    expect(content).toContain("After text.");
    expect(content).not.toContain("OLD GUIDANCE");
    expect(content).toContain("new/repo");
    // Exactly one marker block.
    expect(content.match(/moxie-docs:start/g)?.length).toBe(1);
    expect(content.match(/moxie-docs:end/g)?.length).toBe(1);
  });

  it("writes a file path that exists afterward", () => {
    const result = installAgentsBlock(cwd, { repository: "acme/app" });
    expect(existsSync(result.path)).toBe(true);
  });

  it("THROWS and leaves the file unchanged when only a start marker is present", () => {
    const file = join(cwd, "AGENTS.md");
    const original = [
      "# Top",
      "",
      "<!-- moxie-docs:start -->",
      "stray content with no end marker",
      "",
      "Human notes that must survive.",
      "",
    ].join("\n");
    writeFileSync(file, original, "utf8");

    expect(() => installAgentsBlock(cwd, { repository: "acme/app" })).toThrow(
      CorruptMarkersError,
    );
    // Unchanged — no second start marker was appended.
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("THROWS when markers are misordered (end before start)", () => {
    const file = join(cwd, "AGENTS.md");
    const original = [
      "<!-- moxie-docs:end -->",
      "weird",
      "<!-- moxie-docs:start -->",
      "",
    ].join("\n");
    writeFileSync(file, original, "utf8");

    expect(() => installAgentsBlock(cwd, { repository: "acme/app" })).toThrow(
      CorruptMarkersError,
    );
    expect(readFileSync(file, "utf8")).toBe(original);
  });
});
