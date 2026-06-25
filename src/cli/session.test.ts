import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCredentials,
  saveCredentials,
  type StoredCredentials,
} from "./credentials";
import { getFreshCredentials } from "./session";
import type { FetchImpl } from "./oauth";

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), "moxie-session-"));
});

afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getFreshCredentials", () => {
  it("returns null when no credentials are stored", async () => {
    expect(await getFreshCredentials(baseDir)).toBeNull();
  });

  it("returns stored credentials unchanged when not expired", async () => {
    const creds: StoredCredentials = {
      clientId: "c",
      accessToken: "live",
      refreshToken: "r1",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
      scope: "context:read",
      obtainedAt: new Date().toISOString(),
    };
    saveCredentials(creds, baseDir);
    const fetchSpy = vi.fn();
    const result = await getFreshCredentials(
      baseDir,
      fetchSpy as unknown as FetchImpl,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result?.accessToken).toBe("live");
    expect(result?.refreshToken).toBe("r1");
  });

  it("refreshes an expired token and PERSISTS the rotated refresh token", async () => {
    const expired: StoredCredentials = {
      clientId: "client-123",
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
      scope: "context:read",
      obtainedAt: new Date(Date.now() - 7200_000).toISOString(),
    };
    saveCredentials(expired, baseDir);

    const fetchImpl: FetchImpl = vi.fn(async () =>
      jsonResponse({
        access_token: "new-access",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "rotated-refresh",
        scope: "context:read",
      }),
    ) as unknown as FetchImpl;

    const result = await getFreshCredentials(baseDir, fetchImpl);

    // Returned creds are refreshed.
    expect(result?.accessToken).toBe("new-access");
    expect(result?.refreshToken).toBe("rotated-refresh");

    // Critically: the rotated refresh token was persisted to disk.
    const persisted = loadCredentials(baseDir);
    expect(persisted?.accessToken).toBe("new-access");
    expect(persisted?.refreshToken).toBe("rotated-refresh");
    // And the old one is gone.
    expect(persisted?.refreshToken).not.toBe("old-refresh");
  });
});
