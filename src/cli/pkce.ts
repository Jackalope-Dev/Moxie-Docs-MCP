import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE (RFC 7636) helpers for the OAuth authorization-code flow.
 *
 * The code verifier is a high-entropy random string; the challenge is the
 * base64url-encoded SHA-256 of the verifier (the "S256" method). State is an
 * independent random value used as a CSRF guard on the redirect.
 */

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a PKCE code verifier: 32 random bytes encoded as base64url, which
 * yields a ~43-character string in the RFC 7636 unreserved charset.
 */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/**
 * Compute the S256 code challenge for a verifier: base64url(sha256(verifier)),
 * with no padding.
 */
export function computeCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/**
 * Generate an opaque, random state token (base64url) for CSRF protection on
 * the OAuth redirect.
 */
export function generateState(): string {
  return base64url(randomBytes(32));
}
