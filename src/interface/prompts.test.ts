import { describe, expect, it } from "vitest";
import { moxieMcpPrompts } from "./prompts";

describe("moxieMcpPrompts", () => {
  it("includes the document-this-change and fix-stale-docs prompts", () => {
    const names = moxieMcpPrompts.map((prompt) => prompt.name);
    expect(names).toContain("document-this-change");
    expect(names).toContain("fix-stale-docs");
  });

  it("gives every prompt a description and optional arguments", () => {
    for (const prompt of moxieMcpPrompts) {
      expect(prompt.description.trim().length).toBeGreaterThan(0);
      for (const arg of prompt.arguments) {
        expect(arg.required).toBe(false);
        expect(arg.description.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
