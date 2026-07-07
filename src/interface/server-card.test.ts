import { describe, expect, it } from "vitest";
import { moxieMcpPrompts } from "./prompts";
import {
  buildMoxieMcpServerCard,
  moxieMcpPublicMethods,
  moxieMcpServerCard,
} from "./server-card";
import { MOXIE_MCP_ENDPOINT } from "./skill";
import { moxieMcpTools } from "./tools";

describe("moxieMcpServerCard", () => {
  it("includes the full public tool and prompt catalogs", () => {
    expect(moxieMcpServerCard.tools).toEqual(moxieMcpTools);
    expect(moxieMcpServerCard.prompts).toEqual(moxieMcpPrompts);
    expect(moxieMcpServerCard.publicMethods).toEqual(moxieMcpPublicMethods);
    expect(moxieMcpServerCard.transport.endpoint).toBe(MOXIE_MCP_ENDPOINT);
  });

  it("allows overriding discovery URLs for tests", () => {
    const card = buildMoxieMcpServerCard({
      endpoint: "https://example.test/api/mcp",
      documentation: "https://example.test/mcp",
    });

    expect(card.transport.endpoint).toBe("https://example.test/api/mcp");
    expect(card.documentation).toBe("https://example.test/mcp");
  });
});