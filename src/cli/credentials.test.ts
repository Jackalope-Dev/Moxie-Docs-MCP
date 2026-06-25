import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearCredentials,
  computeExpiresAt,
  isAccessTokenExpired,
  loadCredentials,
  saveCredentials,
  type StoredCredentials,
} from "./credentials";

let baseDir: string;

const sample: StoredCredentials = {
  clientId: "client-123",
  accessToken: "moxie_abc",
  refreshToken: "moxr_def",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
  scope: "context:read",
  obtainedAt: new Date().toISOString(),
};

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), "moxie-creds-"));
});

afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe("credentials round-trip", () => {
  it("save → load → clear", () => {
    expect(loadCredentials(baseDir)).toBeNull();
    saveCredentials(sample, baseDir);
    expect(loadCredentials(baseDir)).toEqual(sample);
    clearCredentials(baseDir);
    expect(loadCredentials(baseDir)).toBeNull();
  });

  it("clear is a no-op when no file exists", () => {
    expect(() => clearCredentials(baseDir)).not.toThrow();
  });
});

describe("computeExpiresAt / isAccessTokenExpired", () => {
  it("applies the 60s safety skew", () => {
    const now = 1_000_000_000_000;
    const iso = computeExpiresAt(3600, now);
    // 3600s lifetime minus 60s skew
    expect(Date.parse(iso)).toBe(now + 3600_000 - 60_000);
  });

  it("is not expired well before expiry", () => {
    const creds: StoredCredentials = {
      ...sample,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    expect(isAccessTokenExpired(creds)).toBe(false);
  });

  it("is expired once past expiresAt", () => {
    const creds: StoredCredentials = {
      ...sample,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(isAccessTokenExpired(creds)).toBe(true);
  });

  it("treats an unparseable expiresAt as expired", () => {
    const creds: StoredCredentials = { ...sample, expiresAt: "not-a-date" };
    expect(isAccessTokenExpired(creds)).toBe(true);
  });
});
