import { MOXIE_SITE_URL } from "../interface/skill";
import { startCallbackServer } from "./callback-server";
import { computeCodeChallenge, generateCodeVerifier, generateState } from "./pkce";
import {
  buildAuthorizeUrl,
  discoverAuthServer,
  exchangeAuthorizationCode,
  refreshAccessToken,
  registerClient,
  type FetchImpl,
  type TokenResponse,
} from "./oauth";
import { openBrowser as defaultOpenBrowser } from "./browser";
import {
  computeExpiresAt,
  isAccessTokenExpired,
  type StoredCredentials,
} from "./credentials";

/**
 * High-level interactive authorization orchestration used by the login/setup
 * commands. Wires PKCE + DCR + the loopback callback server + the token
 * exchange, surfacing progress through an injected logger and never logging
 * the code or tokens.
 */

export interface AuthorizeResult {
  tokens: TokenResponse;
  clientId: string;
  tokenEndpoint: string;
}

export interface AuthorizeOptions {
  siteUrl?: string;
  /** Open the system browser automatically; when false, just print the URL. */
  openBrowser?: boolean;
  /** Progress logger. Defaults to a no-op. */
  log?: (message: string) => void;
  /** Injectable for tests. */
  fetchImpl?: FetchImpl;
  /** Injectable browser launcher for tests. */
  openBrowserImpl?: (url: string) => boolean;
  /** Callback redirect timeout in ms. */
  timeoutMs?: number;
}

/**
 * Run the full interactive authorization-code + PKCE flow and return the
 * resulting tokens, the registered client id, and the token endpoint. The
 * caller is responsible for persisting the result.
 */
export async function authorizeInteractive({
  siteUrl = MOXIE_SITE_URL,
  openBrowser = true,
  log = () => {},
  fetchImpl = fetch,
  openBrowserImpl = defaultOpenBrowser,
  timeoutMs,
}: AuthorizeOptions = {}): Promise<AuthorizeResult> {
  log("Discovering Moxie Docs authorization server…");
  const metadata = await discoverAuthServer(siteUrl, fetchImpl);

  const verifier = generateCodeVerifier();
  const codeChallenge = computeCodeChallenge(verifier);
  const state = generateState();

  log("Starting local callback listener…");
  const callback = await startCallbackServer({ expectedState: state });

  log("Registering this CLI as an OAuth client…");
  const clientId = await registerClient(
    metadata.registrationEndpoint,
    callback.redirectUri,
    fetchImpl,
  );

  const authorizeUrl = buildAuthorizeUrl({
    authorizationEndpoint: metadata.authorizationEndpoint,
    clientId,
    redirectUri: callback.redirectUri,
    codeChallenge,
    state,
  });

  let opened = false;
  if (openBrowser) {
    opened = openBrowserImpl(authorizeUrl);
  }
  if (opened) {
    log("Opened your browser to finish signing in.");
    log("If it didn't open, visit this URL:");
  } else {
    log("Open this URL in your browser to sign in:");
  }
  log(authorizeUrl);

  log("Waiting for you to authorize in the browser…");
  const { code } = await callback.waitForCode(timeoutMs);

  log("Exchanging the authorization code for tokens…");
  const tokens = await exchangeAuthorizationCode(
    {
      tokenEndpoint: metadata.tokenEndpoint,
      code,
      redirectUri: callback.redirectUri,
      clientId,
      codeVerifier: verifier,
    },
    fetchImpl,
  );

  log("Signed in to Moxie Docs.");
  return { tokens, clientId, tokenEndpoint: metadata.tokenEndpoint };
}

/**
 * Ensure the stored access token is fresh. If it is expired, refresh it and
 * return updated credentials (with the rotated refresh token persisted by the
 * caller). If still valid, returns the input unchanged.
 */
export async function ensureFreshAccessToken(
  creds: StoredCredentials,
  fetchImpl: FetchImpl = fetch,
): Promise<StoredCredentials> {
  if (!isAccessTokenExpired(creds)) {
    return creds;
  }

  const refreshed = await refreshAccessToken(
    {
      tokenEndpoint: creds.tokenEndpoint,
      refreshToken: creds.refreshToken,
      clientId: creds.clientId,
    },
    fetchImpl,
  );

  const now = Date.now();
  return {
    ...creds,
    accessToken: refreshed.access_token,
    // Refresh tokens rotate; always persist the NEW one.
    refreshToken: refreshed.refresh_token,
    scope: refreshed.scope,
    expiresAt: computeExpiresAt(refreshed.expires_in, now),
    obtainedAt: new Date(now).toISOString(),
  };
}
