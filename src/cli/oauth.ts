/**
 * OAuth 2.1 + PKCE primitives for talking to the Moxie Docs auth server.
 *
 * Every function takes its endpoints explicitly and accepts an injectable
 * `fetchImpl` so the flow is testable without real network access. None of
 * these functions read process state or persist anything — they are the pure
 * transport layer. Tokens are never logged here.
 */

/** Default OAuth scope requested by the CLI. */
export const DEFAULT_SCOPE = "context:read";

/** The protected MCP resource these tokens are minted for (RFC 8707). */
export const DEFAULT_RESOURCE = "https://moxiedocs.com/api/mcp";

export type FetchImpl = typeof fetch;

/** Endpoints discovered from the auth-server metadata document. */
export interface AuthServerMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  scopesSupported: string[];
}

/** Successful token-endpoint response (authorization_code or refresh_token). */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface RawAuthServerMetadata {
  issuer?: unknown;
  authorization_endpoint?: unknown;
  token_endpoint?: unknown;
  registration_endpoint?: unknown;
  scopes_supported?: unknown;
}

function asString(value: unknown, field: string, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed ${context}: missing or invalid "${field}".`);
  }
  return value;
}

/**
 * Fetch and parse the RFC 8414 OAuth authorization-server metadata for a site.
 */
export async function discoverAuthServer(
  siteUrl: string,
  fetchImpl: FetchImpl = fetch,
): Promise<AuthServerMetadata> {
  const base = siteUrl.replace(/\/+$/, "");
  const url = `${base}/.well-known/oauth-authorization-server`;
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to discover auth server at ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const raw = (await response.json()) as RawAuthServerMetadata;
  return {
    issuer: asString(raw.issuer, "issuer", "auth-server metadata"),
    authorizationEndpoint: asString(
      raw.authorization_endpoint,
      "authorization_endpoint",
      "auth-server metadata",
    ),
    tokenEndpoint: asString(
      raw.token_endpoint,
      "token_endpoint",
      "auth-server metadata",
    ),
    registrationEndpoint: asString(
      raw.registration_endpoint,
      "registration_endpoint",
      "auth-server metadata",
    ),
    scopesSupported: Array.isArray(raw.scopes_supported)
      ? raw.scopes_supported.filter(
          (s): s is string => typeof s === "string",
        )
      : [],
  };
}

/**
 * Dynamic Client Registration (RFC 7591). Registers a public client using the
 * loopback redirect URI and `token_endpoint_auth_method: "none"`. Returns the
 * assigned `client_id`.
 */
export async function registerClient(
  registrationEndpoint: string,
  redirectUri: string,
  fetchImpl: FetchImpl = fetch,
  clientName = "Moxie Docs CLI",
): Promise<string> {
  const response = await fetchImpl(registrationEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: clientName,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (response.status !== 201) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as {
        error?: string;
        error_description?: string;
      };
      if (body.error_description) {
        detail = body.error_description;
      } else if (body.error) {
        detail = body.error;
      }
    } catch {
      // body was not JSON; keep the status line
    }
    throw new Error(`Dynamic client registration failed: ${detail}`);
  }
  const body = (await response.json()) as { client_id?: unknown };
  return asString(body.client_id, "client_id", "registration response");
}

/**
 * Build the authorization-request URL the user opens in their browser.
 */
export function buildAuthorizeUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scope = DEFAULT_SCOPE,
  resource = DEFAULT_RESOURCE,
}: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
  resource?: string;
}): string {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scope);
  url.searchParams.set("resource", resource);
  return url.toString();
}

async function postToken(
  tokenEndpoint: string,
  params: Record<string, string>,
  fetchImpl: FetchImpl,
): Promise<TokenResponse> {
  const body = new URLSearchParams(params).toString();
  const response = await fetchImpl(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }

  if (!response.ok || (json as { error?: unknown })?.error) {
    const err = json as { error?: string; error_description?: string };
    const description =
      err?.error_description ??
      err?.error ??
      `${response.status} ${response.statusText}`;
    throw new Error(`Token request failed: ${description}`);
  }

  const token = json as Partial<TokenResponse>;
  return {
    access_token: asString(
      token.access_token,
      "access_token",
      "token response",
    ),
    token_type: typeof token.token_type === "string" ? token.token_type : "Bearer",
    expires_in: typeof token.expires_in === "number" ? token.expires_in : 3600,
    refresh_token: asString(
      token.refresh_token,
      "refresh_token",
      "token response",
    ),
    scope: typeof token.scope === "string" ? token.scope : DEFAULT_SCOPE,
  };
}

/**
 * Exchange an authorization code for tokens (authorization_code grant).
 * Form-encoded per the live Moxie token endpoint.
 */
export function exchangeAuthorizationCode(
  {
    tokenEndpoint,
    code,
    redirectUri,
    clientId,
    codeVerifier,
  }: {
    tokenEndpoint: string;
    code: string;
    redirectUri: string;
    clientId: string;
    codeVerifier: string;
  },
  fetchImpl: FetchImpl = fetch,
): Promise<TokenResponse> {
  return postToken(
    tokenEndpoint,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    },
    fetchImpl,
  );
}

/**
 * Refresh an access token (refresh_token grant). The auth server rotates the
 * refresh token, so callers MUST persist the new `refresh_token` from the
 * response and discard the one they passed in.
 */
export function refreshAccessToken(
  {
    tokenEndpoint,
    refreshToken,
    clientId,
  }: {
    tokenEndpoint: string;
    refreshToken: string;
    clientId: string;
  },
  fetchImpl: FetchImpl = fetch,
): Promise<TokenResponse> {
  return postToken(
    tokenEndpoint,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    },
    fetchImpl,
  );
}
