import { ensureFreshAccessToken } from "./authorize";
import {
  loadCredentials,
  saveCredentials,
  type StoredCredentials,
} from "./credentials";
import type { FetchImpl } from "./oauth";

/**
 * Single entry point for obtaining a live access token.
 *
 * Loads stored credentials, refreshes the access token if it has expired, and
 * — critically — persists the refreshed credentials so the rotated refresh
 * token is never lost. EVERY command that needs a live access token must go
 * through this helper rather than reading credentials directly, otherwise a
 * rotated refresh token would be dropped and the next refresh would fail.
 *
 * Returns null when no credentials are stored (the user has not logged in).
 */
export async function getFreshCredentials(
  baseDir?: string,
  fetchImpl: FetchImpl = fetch,
): Promise<StoredCredentials | null> {
  const existing = loadCredentials(baseDir);
  if (!existing) {
    return null;
  }
  const fresh = await ensureFreshAccessToken(existing, fetchImpl);
  if (fresh !== existing) {
    // ensureFreshAccessToken returns a NEW object only when it refreshed.
    saveCredentials(fresh, baseDir);
  }
  return fresh;
}
