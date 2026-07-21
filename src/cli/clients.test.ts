import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeHomedir = vi.hoisted(() => ({ current: "" }));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => fakeHomedir.current };
});

import {
  clientConfigPath,
  detectClients,
  isGlobalClient,
  UnparseableConfigError,
  writeClientConfig,
} from "./clients";
import { MOXIE_MCP_ENDPOINT } from "../interface/skill";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "moxie-clients-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

describe("writeClientConfig — claude-code", () => {
  it("creates a URL-only .mcp.json when absent", () => {
    const path = writeClientConfig("claude-code", cwd);
    expect(path).toBe(join(cwd, ".mcp.json"));
    const json = readJson(path);
    expect(json).toEqual({
      mcpServers: { "moxie-docs": { url: MOXIE_MCP_ENDPOINT } },
    });
  });

  it("MERGES into an existing config, preserving other servers and keys", () => {
    const file = join(cwd, ".mcp.json");
    writeFileSync(
      file,
      JSON.stringify({
        someTopLevel: 1,
        mcpServers: {
          other: { url: "https://other.example/mcp" },
          "moxie-docs": { url: "https://stale" },
        },
      }),
      "utf8",
    );
    writeClientConfig("claude-code", cwd);
    const json = readJson(file) as {
      someTopLevel: number;
      mcpServers: Record<string, unknown>;
    };
    expect(json.someTopLevel).toBe(1);
    expect(json.mcpServers.other).toEqual({ url: "https://other.example/mcp" });
    expect(json.mcpServers["moxie-docs"]).toEqual({ url: MOXIE_MCP_ENDPOINT });
  });

  it("includes a Bearer header when a token is supplied", () => {
    const path = writeClientConfig("claude-code", cwd, { token: "tok_123" });
    const json = readJson(path) as { mcpServers: Record<string, unknown> };
    expect(json.mcpServers["moxie-docs"]).toEqual({
      url: MOXIE_MCP_ENDPOINT,
      headers: { Authorization: "Bearer tok_123" },
    });
  });

  it("THROWS rather than clobbering a non-empty file that isn't strict JSON (JSONC)", () => {
    const file = join(cwd, ".mcp.json");
    const original = [
      "{",
      '  // my config',
      '  "mcpServers": {',
      '    "other": { "url": "https://other.example/mcp" }',
      "  }",
      "}",
      "",
    ].join("\n");
    writeFileSync(file, original, "utf8");

    expect(() => writeClientConfig("claude-code", cwd)).toThrow(
      UnparseableConfigError,
    );
    // The file must be left exactly as it was — the other server survives.
    expect(readFileSync(file, "utf8")).toBe(original);
  });
});

describe("writeClientConfig — cursor", () => {
  it("creates .cursor/mcp.json with the mcpServers shape", () => {
    const path = writeClientConfig("cursor", cwd);
    expect(path).toBe(join(cwd, ".cursor", "mcp.json"));
    const json = readJson(path);
    expect(json).toEqual({
      mcpServers: { "moxie-docs": { url: MOXIE_MCP_ENDPOINT } },
    });
  });
});

describe("writeClientConfig — vscode", () => {
  it("uses the servers + type:http shape, creating the dir", () => {
    const path = writeClientConfig("vscode", cwd);
    expect(path).toBe(join(cwd, ".vscode", "mcp.json"));
    const json = readJson(path);
    expect(json).toEqual({
      servers: {
        "moxie-docs": { type: "http", url: MOXIE_MCP_ENDPOINT },
      },
    });
  });

  it("writes the header under the vscode server entry with a token", () => {
    const path = writeClientConfig("vscode", cwd, { token: "tok_vs" });
    const json = readJson(path) as { servers: Record<string, unknown> };
    expect(json.servers["moxie-docs"]).toEqual({
      type: "http",
      url: MOXIE_MCP_ENDPOINT,
      headers: { Authorization: "Bearer tok_vs" },
    });
  });
});

describe("writeClientConfig — zed", () => {
  it("uses the context_servers + plain url shape", () => {
    const path = writeClientConfig("zed", cwd);
    expect(path).toBe(join(cwd, ".zed", "settings.json"));
    const json = readJson(path);
    expect(json).toEqual({
      context_servers: { "moxie-docs": { url: MOXIE_MCP_ENDPOINT } },
    });
  });

  it("preserves other top-level settings.json keys", () => {
    const file = join(cwd, ".zed", "settings.json");
    mkdirSync(join(cwd, ".zed"), { recursive: true });
    writeFileSync(file, JSON.stringify({ theme: "One Dark" }), "utf8");
    writeClientConfig("zed", cwd);
    const json = readJson(file) as { theme: string };
    expect(json.theme).toBe("One Dark");
  });
});

describe("writeClientConfig — windsurf (global)", () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), "moxie-home-"));
    fakeHomedir.current = fakeHome;
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it("is flagged as a global client", () => {
    expect(isGlobalClient("windsurf")).toBe(true);
    expect(isGlobalClient("cursor")).toBe(false);
  });

  it("writes to ~/.codeium/windsurf/mcp_config.json, not the project cwd", () => {
    const path = writeClientConfig("windsurf", cwd);
    expect(path).toBe(
      join(fakeHome, ".codeium", "windsurf", "mcp_config.json"),
    );
    const json = readJson(path);
    expect(json).toEqual({
      mcpServers: { "moxie-docs": { serverUrl: MOXIE_MCP_ENDPOINT } },
    });
  });

  it("uses serverUrl (not url) so Windsurf doesn't silently ignore the entry", () => {
    const path = writeClientConfig("windsurf", cwd, { token: "tok_ws" });
    const json = readJson(path) as { mcpServers: Record<string, unknown> };
    expect(json.mcpServers["moxie-docs"]).toEqual({
      serverUrl: MOXIE_MCP_ENDPOINT,
      headers: { Authorization: "Bearer tok_ws" },
    });
  });

  it("detects windsurf via the home directory, independent of cwd", () => {
    mkdirSync(join(fakeHome, ".codeium", "windsurf"), { recursive: true });
    expect(detectClients(cwd)).toContain("windsurf");
  });
});

describe("detectClients", () => {
  it("detects nothing in an empty dir", () => {
    expect(detectClients(cwd)).toEqual([]);
  });

  it("detects a client by its config file", () => {
    writeFileSync(join(cwd, ".mcp.json"), "{}", "utf8");
    expect(detectClients(cwd)).toContain("claude-code");
  });

  it("detects a client by its tool directory", () => {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    expect(detectClients(cwd)).toContain("cursor");
  });
});

describe("clientConfigPath", () => {
  it("returns the joined path", () => {
    expect(clientConfigPath("vscode", cwd)).toBe(
      join(cwd, ".vscode", "mcp.json"),
    );
  });
});
