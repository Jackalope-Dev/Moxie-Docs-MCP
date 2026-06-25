import {
  detectRepositorySlug,
  installAgentsBlock,
  installSkill,
  REPO_PLACEHOLDER,
} from "../skills-install";
import { flagString, parseArgs } from "../args";
import { bold, cyan, dim, green, print } from "../ui";

/**
 * `moxie-docs install-skill [--repo owner/name]` — write the moxie-docs SKILL.md
 * to both skill paths and the guidance block into AGENTS.md, substituting the
 * repository slug (auto-detected from git, or supplied via --repo).
 */
export async function run(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);
  const cwd = process.cwd();

  const explicit = flagString(flags, "repo");
  const detected = explicit ?? detectRepositorySlug(cwd);
  const repository = detected ?? REPO_PLACEHOLDER;

  const skill = installSkill(cwd, { repository });
  const agents = installAgentsBlock(cwd, { repository });

  print(`${green("✓")} Installed the moxie-docs skill for ${bold(repository)}.`);
  for (const p of skill.paths) {
    print(`  ${dim("skill")}  ${p}`);
  }
  print(
    `  ${dim("agents")} ${agents.path} (${agents.action})`,
  );

  if (!detected) {
    print();
    print(
      `Could not detect a git repository. Edit the placeholder ${cyan(REPO_PLACEHOLDER)} ` +
        `in the files above, or re-run with ${cyan("--repo owner/name")}.`,
    );
  }
}
