import { MOXIE_SITE_URL } from "../../interface/skill";
import { authorizeInteractive } from "../authorize";
import { computeExpiresAt, saveCredentials } from "../credentials";
import { openBrowser as defaultOpenBrowser } from "../browser";
import {
  CLIENT_NAMES,
  clientLabel,
  detectClients,
  isClientName,
  isGlobalClient,
  writeClientConfig,
  type ClientName,
} from "../clients";
import {
  detectRepositorySlug,
  installAgentsBlock,
  installSkill,
  REPO_PLACEHOLDER,
} from "../skills-install";
import { fetchMcpStatus, type McpStatus } from "../mcp-check";
import { getFreshCredentials } from "../session";
import { flagBool, flagString, parseArgs } from "../args";
import {
  bold,
  confirm,
  cyan,
  dim,
  green,
  print,
  prompt,
} from "../ui";

/**
 * `moxie-docs setup` — the headline onboarding orchestrator.
 *
 * Walks the user through: signing in (OAuth, creating an account if needed),
 * verifying their account can see a repo, writing the MCP client config, and
 * installing the agent skill + AGENTS guidance.
 *
 * The 1-hour-token rule: client config is written URL-only by default so the
 * client performs its own durable OAuth. A static Authorization header is only
 * written when the user opts in and supplies a long-lived dashboard token — the
 * CLI's own ephemeral OAuth access token is NEVER written into client config.
 *
 * Flags make every prompt skippable for non-interactive use: `--yes`,
 * `--client <name>` (repeatable via comma list), `--token`, `--no-browser`,
 * `--repo`.
 */
export async function run(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);
  const cwd = process.cwd();
  const yes = flagBool(flags, "yes");
  const openBrowser = !flagBool(flags, "no-browser");
  const dashboardUrl = `${MOXIE_SITE_URL}/dashboard`;

  // 1. Greet + detect environment.
  print(bold("Moxie Docs setup"));
  print(dim("Connect this repo's agents to your living documentation.\n"));

  const explicitRepo = flagString(flags, "repo");
  const detectedRepo = explicitRepo ?? detectRepositorySlug(cwd);
  const repository = detectedRepo ?? REPO_PLACEHOLDER;
  if (detectedRepo) {
    print(`Repository: ${bold(detectedRepo)}`);
  } else {
    print(
      `Repository: ${dim("not detected")} — using placeholder ${cyan(REPO_PLACEHOLDER)}.`,
    );
  }

  const detectedClients = detectClients(cwd);
  if (detectedClients.length > 0) {
    print(
      `Detected client${detectedClients.length > 1 ? "s" : ""}: ${detectedClients
        .map((c) => clientLabel(c))
        .join(", ")}`,
    );
  }
  print();

  // 2. Ensure the CLI is signed in (creates an account via the browser if new).
  let creds = await getFreshCredentials();
  if (!creds) {
    print("You're not signed in yet — let's sign you in (or create an account).");
    const result = await authorizeInteractive({
      openBrowser,
      log: (message) => print(message),
    });
    const now = Date.now();
    const stored = {
      clientId: result.clientId,
      accessToken: result.tokens.access_token,
      refreshToken: result.tokens.refresh_token,
      expiresAt: computeExpiresAt(result.tokens.expires_in, now),
      tokenEndpoint: result.tokenEndpoint,
      scope: result.tokens.scope,
      obtainedAt: new Date(now).toISOString(),
    };
    saveCredentials(stored);
    creds = stored;
    print(`${green("✓")} Signed in.\n`);
  } else {
    print(`${green("✓")} Already signed in.\n`);
  }

  // 3. Smoke / account check: can this account see a connected repo?
  let status = await fetchMcpStatus(creds.accessToken);
  if (status.repositories.length === 0) {
    print(
      "Your account has no connected repositories yet. Connect one in the dashboard,",
    );
    print(`then come back here. Opening ${cyan(dashboardUrl)} …`);
    if (openBrowser) {
      defaultOpenBrowser(dashboardUrl);
    }
    if (!yes) {
      await prompt(
        "Press Enter once you've connected a repository to re-check…",
      );
      // Refresh through the session helper so a rotated token is persisted.
      const refreshed = await getFreshCredentials();
      if (refreshed) {
        creds = refreshed;
      }
      status = await fetchMcpStatus(creds.accessToken);
    }
    if (status.repositories.length === 0) {
      print(
        dim(
          "Still no repositories visible — you can finish connecting later and re-run `moxie-docs setup`.",
        ),
      );
    }
  }
  if (status.repositories.length > 0) {
    print(
      `${green("✓")} ${String(status.repositories.length)} repositor${status.repositories.length === 1 ? "y" : "ies"} visible to your account.\n`,
    );
  }

  // 4. Choose which client(s) to configure.
  const clients = await resolveClients(flags, detectedClients, yes);

  // Decide token vs URL-only. Default is URL-only (durable OAuth).
  let token = flagString(flags, "token");
  if (token === undefined && !yes) {
    const useToken = await confirm(
      "Use a static dashboard token instead of per-client OAuth sign-in?",
      false,
    );
    if (useToken) {
      print(
        `Open ${cyan(`${dashboardUrl} (MCP settings)`)} and copy a token.`,
      );
      if (openBrowser) {
        defaultOpenBrowser(dashboardUrl);
      }
      const pasted = (await prompt("Paste your dashboard token:")).trim();
      if (pasted.length > 0) {
        token = pasted;
      }
    }
  }

  const writtenConfigs: string[] = [];
  for (const client of clients) {
    if (isGlobalClient(client)) {
      print(
        dim(
          `  Heads up: ${clientLabel(client)}'s MCP config is global — this will affect every project you open in ${clientLabel(client)}, not just this one.`,
        ),
      );
    }
    const path = writeClientConfig(client, cwd, { token });
    writtenConfigs.push(`${clientLabel(client)}: ${path}`);
  }

  // 5. Install the skill + AGENTS guidance.
  const skill = installSkill(cwd, { repository });
  const agents = installAgentsBlock(cwd, { repository });

  // 6. Final smoke-test + summary.
  const finalStatus = await safeStatus(creds.accessToken, status);

  print();
  print(bold("Setup complete."));
  if (writtenConfigs.length > 0) {
    print(`${green("✓")} MCP client config:`);
    for (const c of writtenConfigs) {
      print(`    ${c}`);
    }
  } else {
    print(
      dim(
        `No MCP client config was written (no valid client selected). Run \`moxie-docs config <${CLIENT_NAMES.join("|")}>\` to add one.`,
      ),
    );
  }
  print(`${green("✓")} Agent skill:`);
  for (const p of skill.paths) {
    print(`    ${p}`);
  }
  print(`    ${agents.path} (${agents.action})`);

  if (finalStatus.repositories.length > 0) {
    print(`${green("✓")} Repositories visible:`);
    for (const repo of finalStatus.repositories) {
      print(`    - ${repo.fullName}`);
    }
  }

  print();
  if (token) {
    print(dim("Your client config uses a static dashboard token."));
  } else {
    print(
      dim(
        "Your agent will prompt you to sign in to Moxie Docs the first time it connects.",
      ),
    );
  }
  if (!detectedRepo) {
    print(
      dim(
        `Heads up: edit the ${REPO_PLACEHOLDER} placeholder in the skill/AGENTS files, or re-run with --repo owner/name.`,
      ),
    );
  }
  print(dim(`Manage your plan and billing at ${dashboardUrl}.`));
}

/**
 * Resolve the set of clients to configure: from --client, else detected, else
 * prompt (or all *local* clients when --yes and nothing detected).
 *
 * Global clients (Windsurf) are excluded from the blanket "select everything"
 * fallbacks below — writing their config affects every project the user opens
 * in that tool, so we only ever touch it when the user names it explicitly
 * (--client windsurf) or `detectClients` found it actually installed.
 */
async function resolveClients(
  flags: Record<string, string | boolean>,
  detected: ClientName[],
  yes: boolean,
): Promise<ClientName[]> {
  const clientFlag = flagString(flags, "client");
  if (clientFlag) {
    const requested = clientFlag
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const valid = requested.filter((c): c is ClientName => isClientName(c));
    const dropped = requested.filter((c) => !isClientName(c));
    if (dropped.length > 0) {
      print(
        `Ignoring unknown client${dropped.length > 1 ? "s" : ""}: ${dropped.join(", ")}. Supported: ${CLIENT_NAMES.join(", ")}.`,
      );
    }
    return valid;
  }

  if (detected.length > 0) {
    return detected;
  }

  const localClients = CLIENT_NAMES.filter((c) => !isGlobalClient(c));

  if (yes) {
    return [...localClients];
  }

  print("Which client(s) do you want to configure?");
  print(`  Options: ${CLIENT_NAMES.join(", ")} (comma-separated, or "all")`);
  print(
    dim(
      `  ("all" configures ${localClients.join(", ")} — name a global client like windsurf explicitly to include it)`,
    ),
  );
  const answer = (await prompt("Clients:")).trim().toLowerCase();
  if (answer === "" || answer === "all") {
    return [...localClients];
  }
  return answer
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is ClientName => isClientName(c));
}

/** Re-run the smoke test, falling back to the prior status on failure. */
async function safeStatus(
  accessToken: string,
  fallback: McpStatus,
): Promise<McpStatus> {
  try {
    return await fetchMcpStatus(accessToken);
  } catch {
    return fallback;
  }
}
