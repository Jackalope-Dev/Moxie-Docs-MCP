import { describe, expect, it } from "vitest";
import { moxieMcpProtocolVersion, moxieMcpServerInfo } from "./interface/server-info";
import {
  MOXIE_MCP_ENDPOINT,
  MOXIE_SITE_URL,
  moxieDocsSkillMarkdown,
} from "./interface/skill";

// Network-bound: asserts this package's snapshot still matches the live Moxie
// Docs server. Skipped by default so `npm test` stays offline-safe; the
// drift-check workflow (and `MOXIE_DRIFT_CHECK=1 npm test` locally) runs it.
const enabled = process.env.MOXIE_DRIFT_CHECK === "1";

describe.skipIf(!enabled)("interface snapshot matches the live server", () => {
  it("server card metadata matches", async () => {
    const response = await fetch(`${MOXIE_SITE_URL}/.well-known/mcp/server-card.json`);
    expect(response.ok).toBe(true);

    const card = (await response.json()) as {
      serverInfo: { name: string; version: string };
      protocolVersion: string;
      transport: { endpoint: string };
    };

    expect(card.serverInfo.name).toBe(moxieMcpServerInfo.name);
    expect(card.serverInfo.version).toBe(moxieMcpServerInfo.version);
    expect(card.protocolVersion).toBe(moxieMcpProtocolVersion);
    expect(card.transport.endpoint).toBe(MOXIE_MCP_ENDPOINT);
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
