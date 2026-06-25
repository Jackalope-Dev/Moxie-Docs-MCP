import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { MOXIE_MCP_ENDPOINT } from "../interface/skill";

/**
 * Client registry + detection + MCP-config writers.
 *
 * Each supported client stores its MCP server list in a JSON file. We MERGE
 * into that file — adding or replacing only the `moxie-docs` entry — so we
 * never clobber a user's other configured servers.
 *
 * Per the 1-hour-token design rule, the default config is URL-only (the client
 * does its own OAuth). A long-lived dashboard token is written as an
 * Authorization header only when explicitly supplied.
 */

export const SERVER_KEY = "moxie-docs";

export type ClientName = "claude-code" | "cursor" | "vscode";

export const CLIENT_NAMES: readonly ClientName[] = [
  "claude-code",
  "cursor",
  "vscode",
];

interface ClientSpec {
  name: ClientName;
  /** Human label for messaging. */
  label: string;
  /** Config file path relative to the project root. */
  configFile: string;
  /**
   * Extra paths whose presence signals the client is in use (so we can detect
   * it even before any MCP config exists).
   */
  markerPaths: string[];
}

const CLIENT_SPECS: Record<ClientName, ClientSpec> = {
  "claude-code": {
    name: "claude-code",
    label: "Claude Code",
    configFile: ".mcp.json",
    markerPaths: [".mcp.json", ".claude"],
  },
  cursor: {
    name: "cursor",
    label: "Cursor",
    configFile: join(".cursor", "mcp.json"),
    markerPaths: [join(".cursor", "mcp.json"), ".cursor"],
  },
  vscode: {
    name: "vscode",
    label: "VS Code",
    configFile: join(".vscode", "mcp.json"),
    markerPaths: [join(".vscode", "mcp.json"), ".vscode"],
  },
};

export function isClientName(value: string): value is ClientName {
  return (CLIENT_NAMES as readonly string[]).includes(value);
}

export function clientLabel(client: ClientName): string {
  return CLIENT_SPECS[client].label;
}

export function clientConfigPath(client: ClientName, cwd: string): string {
  return join(cwd, CLIENT_SPECS[client].configFile);
}

/**
 * Detect which supported clients appear to be in use in `cwd` — either their
 * MCP config file or their tool directory exists.
 */
export function detectClients(cwd: string): ClientName[] {
  return CLIENT_NAMES.filter((name) =>
    CLIENT_SPECS[name].markerPaths.some((rel) => existsSync(join(cwd, rel))),
  );
}

/**
 * Thrown when an existing, non-empty config file cannot be parsed as strict
 * JSON. Overwriting it would silently delete the user's other MCP servers, so
 * the caller must abort rather than clobber.
 */
export class UnparseableConfigError extends Error {
  constructor(public readonly file: string) {
    super(
      `Refusing to overwrite ${file} — it isn't valid JSON (it may use comments/JSONC). Fix or remove it, then re-run.`,
    );
    this.name = "UnparseableConfigError";
  }
}

/**
 * Read the existing config as a plain object.
 *
 * Distinguishes "absent or empty" (safe to start from `{}`) from "present and
 * non-empty but unparseable" (DANGER — throws so the caller aborts rather than
 * destroying the user's other servers). We deliberately do NOT hand-roll a
 * JSONC parser.
 */
function readJsonObject(file: string): Record<string, unknown> {
  if (!existsSync(file)) {
    return {};
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    // Unreadable (e.g. removed after the existsSync check) — treat as absent.
    return {};
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Present, non-empty, and not strict JSON: refuse to clobber it.
    throw new UnparseableConfigError(file);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  // Valid JSON but not an object (array/scalar) — also unsafe to merge into.
  throw new UnparseableConfigError(file);
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Build the `moxie-docs` server entry for a given client. URL-only by default;
 * includes a Bearer Authorization header only when a token is supplied.
 */
function buildServerEntry(
  client: ClientName,
  token: string | undefined,
): Record<string, unknown> {
  if (client === "vscode") {
    const entry: Record<string, unknown> = {
      type: "http",
      url: MOXIE_MCP_ENDPOINT,
    };
    if (token) {
      entry.headers = { Authorization: `Bearer ${token}` };
    }
    return entry;
  }
  // claude-code and cursor share the same shape.
  const entry: Record<string, unknown> = { url: MOXIE_MCP_ENDPOINT };
  if (token) {
    entry.headers = { Authorization: `Bearer ${token}` };
  }
  return entry;
}

export interface WriteClientConfigOptions {
  /** Long-lived dashboard token. When omitted, the config is URL-only. */
  token?: string;
}

/**
 * Merge the `moxie-docs` MCP server entry into the client's config file,
 * preserving every other server and top-level key. Creates the file and its
 * parent directory when absent. Returns the path written.
 */
export function writeClientConfig(
  client: ClientName,
  cwd: string,
  options: WriteClientConfigOptions = {},
): string {
  const file = clientConfigPath(client, cwd);
  const config = readJsonObject(file);

  const containerKey = client === "vscode" ? "servers" : "mcpServers";
  const container = asObject(config[containerKey]);
  container[SERVER_KEY] = buildServerEntry(client, options.token);
  config[containerKey] = container;

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return file;
}
