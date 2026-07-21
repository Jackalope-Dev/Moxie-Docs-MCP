#!/usr/bin/env node
import { print, printError } from "./ui";

/**
 * moxie-docs CLI entry point + router.
 *
 * The command modules are imported lazily so `--help`/`--version` and routing
 * stay cheap and unit-testable, and so a failure to load one command can't
 * break the others.
 */

const VERSION = "0.1.0";

type CommandRunner = (args: string[]) => Promise<void>;

interface CommandSpec {
  summary: string;
  load: () => Promise<{ run: CommandRunner }>;
}

const COMMANDS: Record<string, CommandSpec> = {
  setup: {
    summary: "Sign in, configure your MCP client, and install the agent skill.",
    load: () => import("./commands/setup"),
  },
  login: {
    summary: "Sign in to Moxie Docs (OAuth in your browser).",
    load: () => import("./commands/login"),
  },
  logout: {
    summary: "Remove stored credentials.",
    load: () => import("./commands/logout"),
  },
  status: {
    summary: "Show your scope, connected repositories, and tool count.",
    load: () => import("./commands/status"),
  },
  config: {
    summary: "Write the moxie-docs MCP server entry into a client config.",
    load: () => import("./commands/config"),
  },
  "install-skill": {
    summary: "Install the moxie-docs agent skill and AGENTS.md guidance.",
    load: () => import("./commands/install-skill"),
  },
  check: {
    summary: "Check local git changes for documentation drift.",
    load: () => import("./commands/check"),
  },
};

function helpText(): string {
  const lines: string[] = [];
  lines.push("moxie-docs — connect your agents to your living documentation.");
  lines.push("");
  lines.push("Usage: moxie-docs <command> [options]");
  lines.push("");
  lines.push("Commands:");
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  for (const [name, spec] of Object.entries(COMMANDS)) {
    lines.push(`  ${name.padEnd(width)}  ${spec.summary}`);
  }
  lines.push("");
  lines.push("Options:");
  lines.push("  -h, --help       Show this help.");
  lines.push("  --version        Print the version.");
  lines.push("");
  lines.push("Run `moxie-docs setup` to get started.");
  return lines.join("\n");
}

/**
 * Route a raw argv (without `node` / script path) to a command. Returns the
 * process exit code. Pure enough to unit-test: it only touches the injected
 * command table and the print helpers.
 */
export async function route(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    print(helpText());
    return 0;
  }

  if (command === "--version" || command === "-v") {
    print(VERSION);
    return 0;
  }

  const spec = COMMANDS[command];
  if (!spec) {
    printError(`Unknown command "${command}".`);
    print("");
    print(helpText());
    return 1;
  }

  // A bare `--help` after a known command shows the general help too.
  if (rest.includes("--help") || rest.includes("-h")) {
    print(helpText());
    return 0;
  }

  try {
    const mod = await spec.load();
    await mod.run(rest);
    return process.exitCode === 1 ? 1 : 0;
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** Names of the registered commands (for tests + help). */
export const COMMAND_NAMES = Object.keys(COMMANDS);

async function main(): Promise<void> {
  const code = await route(process.argv.slice(2));
  process.exit(code);
}

// Only auto-run when executed as a binary, not when imported by tests.
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /cli(\.[cm]?[tj]s)?$/.test(process.argv[1] ?? "");

if (isMain) {
  void main();
}
