import { describe, expect, it } from "vitest";
import { moxieMcpTools, repositoryArgSchema } from "./tools";

const EXPECTED_TOOL_NAMES = [
  "moxie.get_conventions",
  "moxie.search_docs",
  "moxie.list_docs",
  "moxie.get_doc_gaps",
  "moxie.get_documentation_opportunities",
  "moxie.get_documentation_patterns",
  "moxie.get_ai_context",
  "moxie.get_doc_impact",
  "moxie.propose_doc_update",
  "moxie.propose_doc_removal",
];

describe("moxieMcpTools", () => {
  it("exposes the 10 expected tools in order", () => {
    expect(moxieMcpTools).toHaveLength(10);
    expect(moxieMcpTools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
  });

  it("gives every tool a non-empty description, object input schema, and annotations", () => {
    for (const tool of moxieMcpTools) {
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.inputSchema.properties).toBe("object");
      expect(tool.annotations).toBeDefined();
      expect(tool.annotations.title.trim().length).toBeGreaterThan(0);
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
    }
  });

  it("threads the shared repository arg into each tool schema", () => {
    for (const tool of moxieMcpTools) {
      expect(tool.inputSchema.properties).toHaveProperty("repository");
    }
    expect(repositoryArgSchema.repository.type).toBe("string");
  });
});
