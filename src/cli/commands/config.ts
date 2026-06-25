import {
  CLIENT_NAMES,
  clientLabel,
  isClientName,
  writeClientConfig,
} from "../clients";
import { flagString, parseArgs } from "../args";
import { bold, cyan, dim, green, print, printError } from "../ui";

/**
 * `moxie-docs config <client> [--token <t>]` — write the moxie-docs MCP server
 * entry into the named client's config, merging with any existing servers.
 *
 * Default is URL-only so the OAuth-capable client signs itself in (durable).
 * `--token` writes a long-lived dashboard token as an Authorization header.
 */
export async function run(args: string[]): Promise<void> {
  const { positionals, flags } = parseArgs(args);
  const clientArg = positionals[0];

  if (!clientArg) {
    printError(
      `Specify a client: ${CLIENT_NAMES.join(", ")}. e.g. moxie-docs config claude-code`,
    );
    process.exitCode = 1;
    return;
  }
  if (!isClientName(clientArg)) {
    printError(
      `Unknown client "${clientArg}". Supported: ${CLIENT_NAMES.join(", ")}.`,
    );
    process.exitCode = 1;
    return;
  }

  const token = flagString(flags, "token");
  const path = writeClientConfig(clientArg, process.cwd(), { token });

  print(`${green("✓")} Wrote ${clientLabel(clientArg)} config: ${bold(path)}`);
  if (token) {
    print(dim("  Configured with a dashboard token (static Authorization header)."));
  } else {
    print(
      dim(
        "  URL-only config — your client will prompt you to sign in on first use.",
      ),
    );
    print(
      dim(
        `  Prefer a static token? Re-run with ${cyan("--token <dashboard-token>")}.`,
      ),
    );
  }
}
