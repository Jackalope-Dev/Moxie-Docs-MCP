/**
 * Minimal argv parser for the CLI commands. Supports `--flag`, `--flag=value`,
 * and `--flag value` for a known set of value-taking flags, plus positional
 * arguments. Zero dependencies.
 */

const VALUE_FLAGS = new Set(["client", "token", "repo"]);

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      const name = body;
      if (VALUE_FLAGS.has(name)) {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[name] = next;
          i++;
          continue;
        }
      }
      flags[name] = true;
      continue;
    }
    positionals.push(arg);
  }

  return { positionals, flags };
}

export function flagString(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagBool(
  flags: Record<string, string | boolean>,
  name: string,
): boolean {
  return flags[name] === true || flags[name] === "true";
}
