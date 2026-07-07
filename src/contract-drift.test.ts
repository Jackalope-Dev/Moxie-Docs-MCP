import { describe, expect, it } from "vitest";
import { moxieMcpPrompts } from "./interface/prompts";
import {
  buildMoxieMcpServerCard,
  moxieMcpPublicMethods,
} from "./interface/server-card";
import { moxieMcpProtocolVersion, moxieMcpServerInfo } from "./interface/server-info";
import {
  MOXIE_MCP_ENDPOINT,
  MOXIE_SITE_URL,
  moxieDocsSkillMarkdown,
} from "./interface/skill";
import { moxieMcpTools } from "./interface/tools";

// Network-bound: asserts this package's snapshot still matches the live Moxie
// Docs server. Skipped by default so `npm test` stays offline-safe; the
// drift-check workflow (and `MOXIE_DRIFT_CHECK=1 npm test` locally) runs it.
const enabled = process.env.MOXIE_DRIFT_CHECK === "1";

describe.skipIf(!enabled)("interface snapshot matches the live server", () => {
  it("server card metadata matches", async () => {
    const response = await fetch(`${MOXIE_SITE_URL}/.well-known/mcp/server-card.json`);
    expect(response.ok).toBe(true);

    const card = (await response.json()) as ReturnType<typeof buildMoxieMcpServerCard>;

    expect(card.serverInfo.name).toBe(moxieMcpServerInfo.name);
    expect(card.serverInfo.version).toBe(moxieMcpServerInfo.version);
    expect(card.protocolVersion).toBe(moxieMcpProtocolVersion);
    expect(card.transport.endpoint).toBe(MOXIE_MCP_ENDPOINT);
    expect(card.publicMethods).toEqual(moxieMcpPublicMethods);
    expect(card.tools.map((tool) => tool.name)).toEqual(
      moxieMcpTools.map((tool) => tool.name),
    );
    expect(card.prompts.map((prompt) => prompt.name)).toEqual(
      moxieMcpPrompts.map((prompt) => prompt.name),
    );
  });

  it("tools/list is available without authentication", async () => {
    const response = await fetch(MOXIE_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "drift-tools",
        method: "tools/list",
        params: {},
      }),
    });

    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      result?: { tools: Array<{ name: string }> };
      error?: unknown;
    };

    expect(payload.error).toBeUndefined();
    expect(payload.result?.tools.map((tool) => tool.name)).toEqual(
      moxieMcpTools.map((tool) => tool.name),
    );
  });

  it("prompts/list is available without authentication", async () => {
    const response = await fetch(MOXIE_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "drift-prompts",
        method: "prompts/list",
        params: {},
      }),
    });

    expect(response.ok).toBe(true);

    const payload = (await response.json()) as {
      result?: { prompts: Array<{ name: string }> };
      error?: unknown;
    };

    expect(payload.error).toBeUndefined();
    expect(payload.result?.prompts.map((prompt) => prompt.name)).toEqual(
      moxieMcpPrompts.map((prompt) => prompt.name),
    );
  });

  it("served skill matches the bundled skill", async () => {
    const response = await fetch(
      `${MOXIE_SITE_URL}/.well-known/agent-skills/moxie-docs/SKILL.md`,
    );
    expect(response.ok).toBe(true);

    const served = await response.text();
    expect(served.trim()).toBe(moxieDocsSkillMarkdown.trim());
  });
});
