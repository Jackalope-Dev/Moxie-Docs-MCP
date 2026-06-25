import { homedir } from "node:os";
import { join } from "node:path";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

/**
 * On-disk credential storage at ~/.moxie-docs/credentials.json.
 *
 * The directory is created 0700 and the file 0600 on a best-effort basis; on
 * Windows chmod is a no-op, which is fine — the file is still written. A
 * `baseDir` override is accepted purely so tests can use a temp HOME.
 */

const DIR_NAME = ".moxie-docs";
const FILE_NAME = "credentials.json";

/** Safety skew (ms) subtracted from token lifetime to refresh slightly early. */
const EXPIRY_SKEW_MS = 60_000;

export interface StoredCredentials {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Absolute ISO timestamp at which the access token should be treated as expired. */
  expiresAt: string;
  tokenEndpoint: string;
  scope: string;
  /** Absolute ISO timestamp at which these credentials were obtained. */
  obtainedAt: string;
}

function resolveDir(baseDir?: string): string {
  return join(baseDir ?? homedir(), DIR_NAME);
}

function resolveFile(baseDir?: string): string {
  return join(resolveDir(baseDir), FILE_NAME);
}

/**
 * Compute the absolute expiry ISO timestamp from a token lifetime in seconds,
 * applying the safety skew so we refresh slightly before the true expiry.
 */
export function computeExpiresAt(
  expiresInSeconds: number,
  now: number = Date.now(),
): string {
  const expiresAtMs = now + expiresInSeconds * 1000 - EXPIRY_SKEW_MS;
  return new Date(expiresAtMs).toISOString();
}

/** True when the stored access token is at or past its (skewed) expiry. */
export function isAccessTokenExpired(
  creds: StoredCredentials,
  now: number = Date.now(),
): boolean {
  const expiresAtMs = Date.parse(creds.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return true;
  }
  return now >= expiresAtMs;
}

/**
 * Persist credentials, creating ~/.moxie-docs with restrictive permissions
 * (best-effort) before writing the file 0600.
 */
export function saveCredentials(
  creds: StoredCredentials,
  baseDir?: string,
): void {
  const dir = resolveDir(baseDir);
  const file = resolveFile(baseDir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
  } catch {
    // best-effort (no-op on Windows)
  }
  writeFileSync(file, `${JSON.stringify(creds, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    chmodSync(file, 0o600);
  } catch {
    // best-effort (no-op on Windows)
  }
}

/** Load and parse stored credentials, or null if none exist / are unreadable. */
export function loadCredentials(baseDir?: string): StoredCredentials | null {
  const file = resolveFile(baseDir);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredCredentials;
  } catch {
    return null;
  }
}

/** Delete the credentials file if it exists. */
export function clearCredentials(baseDir?: string): void {
  const file = resolveFile(baseDir);
  rmSync(file, { force: true });
}

/** Path to the credentials file (for messaging to the user). */
export function credentialsPath(baseDir?: string): string {
  return resolveFile(baseDir);
}
