import { describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { openBrowser } from "./browser";

vi.mock("node:child_process", () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    unref: vi.fn(),
  }),
}));

describe("openBrowser", () => {
  it("escapes ampersands in URLs on Windows so cmd does not treat them as command separators", () => {
    const originalPlatform = process.platform;

    try {
      Object.defineProperty(process, "platform", { value: "win32" });

      const testUrl =
        "https://moxiedocs.com/oauth/authorize?response_type=code&client_id=moxc_123&redirect_uri=http%3A%2F%2F127.0.0.1%3A61701%2Fcallback";
      const result = openBrowser(testUrl);

      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        "cmd",
        [
          "/c",
          "start",
          "",
          "https://moxiedocs.com/oauth/authorize?response_type=code^&client_id=moxc_123^&redirect_uri=http%3A%2F%2F127.0.0.1%3A61701%2Fcallback",
        ],
        expect.objectContaining({ stdio: "ignore", detached: true }),
      );
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });
});
