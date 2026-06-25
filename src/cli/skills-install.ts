import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MOXIE_SKILL_PATHS,
  renderAgentsGuidanceBlock,
  renderSkillMarkdown,
} from "../interface/skill";

/**
 * Install the moxie-docs agent skill and AGENTS.md guidance into a repository.
 *
 * The repository slug (`owner/name`) is best-effort detected from the git
 * `origin` remote; when it can't be determined a visible placeholder is used
 * and the caller is expected to warn the user to edit it.
 */

/** Placeholder used when the repository slug cannot be detected. */
export const REPO_PLACEHOLDER = "your-org/your-repo";

const AGENTS_FILE = "AGENTS.md";
const MARKER_START = "<!-- moxie-docs:start -->";
const MARKER_END = "<!-- moxie-docs:end -->";

/**
 * Thrown when AGENTS.md has a partial or misordered moxie-docs marker pair.
 * Appending in that state would create a second start marker, which on the next
 * run would delete the human content between the two starts — so we abort and
 * ask the user to fix the stray marker(s) instead of corrupting the file.
 */
export class CorruptMarkersError extends Error {
  constructor(public readonly file: string) {
    super(
      `Refusing to edit ${file} — it has an incomplete or misordered moxie-docs marker pair (expected both "${MARKER_START}" and "${MARKER_END}" in order). Fix or remove the stray marker(s), then re-run.`,
    );
    this.name = "CorruptMarkersError";
  }
}

/**
 * Parse a git remote URL into an `owner/name` slug. Handles both SSH
 * (`git@github.com:owner/name.git`) and HTTPS
 * (`https://github.com/owner/name.git`) forms.
 */
export function parseRepositorySlug(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Strip a trailing .git and any trailing slash.
  const cleaned = trimmed.replace(/\.git$/i, "").replace(/\/+$/, "");

  // SSH form: git@host:owner/name
  const sshMatch = cleaned.match(/^[^@]+@[^:]+:(.+)$/);
  // Path candidate is either the SSH path or the URL path.
  let pathPart: string | null = null;
  if (sshMatch) {
    pathPart = sshMatch[1] ?? null;
  } else {
    try {
      const url = new URL(cleaned);
      pathPart = url.pathname.replace(/^\/+/, "");
    } catch {
      // ssh:// without protocol handled above; otherwise give up.
      pathPart = null;
    }
  }
  if (!pathPart) {
    return null;
  }
  const segments = pathPart.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) {
    return null;
  }
  const owner = segments[segments.length - 2];
  const name = segments[segments.length - 1];
  if (!owner || !name) {
    return null;
  }
  return `${owner}/${name}`;
}

/**
 * Best-effort detection of the repository slug from `git remote get-url origin`.
 * Returns null when git is unavailable, there is no origin, or the URL can't be
 * parsed.
 */
export function detectRepositorySlug(cwd: string): string | null {
  let output: string;
  try {
    output = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  return parseRepositorySlug(output);
}

export interface InstallSkillResult {
  /** Absolute paths of the SKILL.md files written. */
  paths: string[];
}

/**
 * Write the moxie-docs SKILL.md to both well-known skill locations, creating
 * directories as needed. Overwrites any existing skill file (it is generated).
 */
export function installSkill(
  cwd: string,
  { repository }: { repository: string },
): InstallSkillResult {
  const markdown = renderSkillMarkdown({ repository });
  const paths: string[] = [];
  for (const rel of MOXIE_SKILL_PATHS) {
    const file = join(cwd, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, markdown, "utf8");
    paths.push(file);
  }
  return { paths };
}

export interface InstallAgentsBlockResult {
  path: string;
  /** "created" when the file did not exist, "updated" when it was edited. */
  action: "created" | "updated";
}

/**
 * Install (or refresh) the moxie-docs guidance block in AGENTS.md.
 *
 * - If the file exists and already contains BOTH markers in order, the content
 *   between the markers is replaced and all surrounding content is preserved.
 * - If the file exists with neither marker, the block is appended.
 * - If the file does not exist, it is created with a "# Repository
 *   Instructions" header followed by the block.
 * - If the file has exactly one marker, or the markers are misordered (end
 *   before start), it is treated as corrupt and a `CorruptMarkersError` is
 *   thrown rather than risking duplicate-marker content loss.
 */
export function installAgentsBlock(
  cwd: string,
  { repository }: { repository: string },
): InstallAgentsBlockResult {
  const file = join(cwd, AGENTS_FILE);
  const guidance = renderAgentsGuidanceBlock({ repository });
  const block = `${MARKER_START}\n${guidance}\n${MARKER_END}`;

  if (!existsSync(file)) {
    const content = `# Repository Instructions\n\n${block}\n`;
    writeFileSync(file, content, "utf8");
    return { path: file, action: "created" };
  }

  const existing = readFileSync(file, "utf8");
  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);
  const hasStart = startIdx !== -1;
  const hasEnd = endIdx !== -1;

  if (hasStart && hasEnd && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + MARKER_END.length);
    const next = `${before}${block}${after}`;
    writeFileSync(file, next, "utf8");
    return { path: file, action: "updated" };
  }

  // Exactly one marker present, or markers misordered: corrupt — abort rather
  // than append a duplicate start that would later swallow human content.
  if (hasStart || hasEnd) {
    throw new CorruptMarkersError(file);
  }

  // Neither marker present: append a fresh block, ensuring blank-line separation.
  const separator = existing.endsWith("\n\n")
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  writeFileSync(file, `${existing}${separator}${block}\n`, "utf8");
  return { path: file, action: "updated" };
}
