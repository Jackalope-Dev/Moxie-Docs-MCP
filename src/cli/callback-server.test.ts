import { describe, expect, it } from "vitest";
import { startCallbackServer } from "./callback-server";

describe("startCallbackServer", () => {
  it("binds to an ephemeral 127.0.0.1 port and resolves the code on matching state", async () => {
    const server = await startCallbackServer({ expectedState: "good-state" });
    expect(server.port).toBeGreaterThan(0);
    expect(server.redirectUri).toBe(
      `http://127.0.0.1:${server.port}/callback`,
    );

    const pending = server.waitForCode();
    const res = await fetch(
      `http://127.0.0.1:${server.port}/callback?code=abc&state=good-state`,
    );
    expect(res.status).toBe(200);
    await expect(pending).resolves.toEqual({ code: "abc" });
  });

  it("rejects on a state mismatch (CSRF guard) and does not resolve the code", async () => {
    const server = await startCallbackServer({ expectedState: "expected" });
    // Attach the rejection assertion before firing so the rejection is never
    // momentarily unhandled.
    const assertion = expect(server.waitForCode()).rejects.toThrow(
      /state mismatch/i,
    );
    const res = await fetch(
      `http://127.0.0.1:${server.port}/callback?code=abc&state=attacker`,
    );
    expect(res.status).toBe(400);
    await assertion;
  });

  it("rejects when the callback carries an error", async () => {
    const server = await startCallbackServer({ expectedState: "s" });
    const assertion = expect(server.waitForCode()).rejects.toThrow(
      /Authorization denied/,
    );
    await fetch(
      `http://127.0.0.1:${server.port}/callback?error=access_denied&state=s`,
    );
    await assertion;
  });

  it("responds 404 to non-callback paths", async () => {
    const server = await startCallbackServer({ expectedState: "s" });
    const pending = server.waitForCode();
    const res = await fetch(`http://127.0.0.1:${server.port}/other`);
    expect(res.status).toBe(404);
    // finish the flow so the server closes
    await fetch(
      `http://127.0.0.1:${server.port}/callback?code=z&state=s`,
    );
    await expect(pending).resolves.toEqual({ code: "z" });
  });
});
