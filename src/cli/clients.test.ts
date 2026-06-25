import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clientConfigPath,
  detectClients,
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
