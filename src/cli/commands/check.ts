import { execSync } from "node:child_process";
import { MOXIE_SITE_URL } from "../../interface/skill";
import { getFreshCredentials } from "../session";
import { detectRepositorySlug } from "../skills-install";
import { parseArgs, flagString } from "../args";
import { bold, cyan, dim, green, print, red } from "../ui";

export async function run(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);
  const cwd = process.cwd();

  print(bold("Moxie Docs - Pre-commit Drift Check"));

  // 1. Ensure signed in
  const creds = await getFreshCredentials();
  if (!creds) {
    print(red("Not signed in. Run `moxie-docs setup` or `moxie-docs login` first."));
    process.exit(1);
  }

  // 2. Detect repository
  const explicitRepo = flagString(flags, "repo");
  const repository = explicitRepo ?? detectRepositorySlug(cwd);
  if (!repository) {
    print(red("Could not detect repository. Use --repo owner/name."));
    process.exit(1);
  }

  // 3. Get changed files
  let changedFiles: string[] = [];
  try {
    // Try to get staged files first (pre-commit hook)
    const staged = execSync("git diff --cached --name-only", { cwd, encoding: "utf8" }).trim();
    if (staged) {
      changedFiles = staged.split("\n").filter(Boolean);
    } else {
      // Fallback to working tree changes
      const working = execSync("git diff --name-only", { cwd, encoding: "utf8" }).trim();
      changedFiles = working.split("\n").filter(Boolean);
    }
  } catch (err) {
    print(red("Failed to read git changes. Are you in a git repository?"));
    process.exit(1);
  }

  if (changedFiles.length === 0) {
    print(green("✓ No changed files to check."));
    process.exit(0);
  }

  print(`Checking ${cyan(changedFiles.length.toString())} changed files in ${bold(repository)}...\n`);

  // 4. Call REST endpoint (which we will build in apps/web)
  const endpoint = `${MOXIE_SITE_URL}/api/v1/check-drift`;
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        repository,
        changedPaths: changedFiles,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      print(red(`Check failed: ${response.status} ${response.statusText}`));
      print(dim(text));
      process.exit(1);
    }

    const result = await response.json() as {
      hasDrift: boolean;
      message: string;
      details: string[];
    };

    if (result.hasDrift) {
      print(red("✗ Documentation drift detected!"));
      print(result.message);
      for (const detail of result.details) {
        print(dim(`  - ${detail}`));
      }
      print(`\nRun your agent to document these changes, or use the ${cyan("document-this-change")} MCP prompt.`);
      process.exit(1);
    } else {
      print(green("✓ No documentation drift detected."));
      process.exit(0);
    }

  } catch (err) {
    print(red("Network error communicating with Moxie Docs."));
    console.error(err);
    process.exit(1);
  }
}
