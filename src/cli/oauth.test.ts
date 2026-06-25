import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  discoverAuthServer,
  exchangeAuthorizationCode,
  refreshAccessToken,
  registerClient,
  type FetchImpl,
} from "./oauth";

const METADATA = {
  issuer: "https://moxiedocs.com",
  authorization_endpoint: "https://moxiedocs.com/oauth/authorize",
  token_endpoint: "https://moxiedocs.com/api/oauth/token",
  registration_endpoint: "https://moxiedocs.com/api/oauth/register",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: ["context:read"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("discoverAuthServer", () => {
  it("fetches and parses the metadata endpoints", async () => {
    let requestedUrl = "";
    const fetchImpl: FetchImpl = async (input) => {
      requestedUrl = String(input);
      return jsonResponse(METADATA);
    };
    const result = await discoverAuthServer("https://moxiedocs.com/", fetchImpl);
    expect(requestedUrl).toBe(
      "https://moxiedocs.com/.well-known/oauth-authorization-server",
    );
    expect(result.tokenEndpoint).toBe("https://moxiedocs.com/api/oauth/token");
    expect(result.registrationEndpoint).toBe(
      "https://moxiedocs.com/api/oauth/register",
    );
    expect(result.scopesSupported).toEqual(["context:read"]);
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl: FetchImpl = async () =>
      new Response("nope", { status: 500, statusText: "Server Error" });
    await expect(
      discoverAuthServer("https://moxiedocs.com", fetchImpl),
    ).rejects.toThrow(/Failed to discover auth server/);
  });
});

describe("registerClient", () => {
  it("POSTs DCR with the loopback redirect and returns client_id", async () => {
    let body: unknown;
    const fetchImpl: FetchImpl = async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse({ client_id: "client-123" }, 201);
    };
    const id = await registerClient(
      "https://moxiedocs.com/api/oauth/register",
      "http://127.0.0.1:5555/callback",
      fetchImpl,
    );
    expect(id).toBe("client-123");
    expect(body).toMatchObject({
      redirect_uris: ["http://127.0.0.1:5555/callback"],
      token_endpoint_auth_method: "none",
    });
  });

  it("throws on a non-201 response", async () => {
    const fetchImpl: FetchImpl = async () =>
      jsonResponse({ error: "invalid_redirect_uri" }, 400);
    await expect(
      registerClient(
        "https://moxiedocs.com/api/oauth/register",
        "http://127.0.0.1:1/callback",
        fetchImpl,
      ),
    ).rejects.toThrow(/invalid_redirect_uri/);
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes PKCE method, scope, resource, and state", () => {
    const url = new URL(
      buildAuthorizeUrl({
        authorizationEndpoint: "https://moxiedocs.com/oauth/authorize",
        clientId: "client-123",
        redirectUri: "http://127.0.0.1:5555/callback",
        codeChallenge: "challenge",
        state: "state-xyz",
      }),
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("scope")).toBe("context:read");
    expect(url.searchParams.get("resource")).toBe(
      "https://moxiedocs.com/api/mcp",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
  });
});

describe("exchangeAuthorizationCode", () => {
  it("sends a correct form body and parses the token response", async () => {
    let contentType = "";
    let body = "";
    const fetchImpl: FetchImpl = async (_input, init) => {
      contentType = String(
        (init?.headers as Record<string, string>)["content-type"],
      );
      body = String(init?.body);
      return jsonResponse({
        access_token: "moxie_abc",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "moxr_def",
        scope: "context:read",
      });
    };
    const tokens = await exchangeAuthorizationCode(
      {
        tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
        code: "the-code",
        redirectUri: "http://127.0.0.1:5555/callback",
        clientId: "client-123",
        codeVerifier: "verifier-xyz",
      },
      fetchImpl,
    );
    expect(contentType).toBe("application/x-www-form-urlencoded");
    expect(body).toBe(
      "grant_type=authorization_code&code=the-code&redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcallback&client_id=client-123&code_verifier=verifier-xyz",
    );
    expect(tokens.access_token).toBe("moxie_abc");
    expect(tokens.refresh_token).toBe("moxr_def");
  });

  it("maps an RFC 6749 error to a thrown error", async () => {
    const fetchImpl: FetchImpl = async () =>
      jsonResponse(
        { error: "invalid_grant", error_description: "code expired" },
        400,
      );
    await expect(
      exchangeAuthorizationCode(
        {
          tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
          code: "x",
          redirectUri: "http://127.0.0.1:1/callback",
          clientId: "c",
          codeVerifier: "v",
        },
        fetchImpl,
      ),
    ).rejects.toThrow(/code expired/);
  });
});

describe("refreshAccessToken", () => {
  it("sends the refresh grant and parses the rotated tokens", async () => {
    let body = "";
    const fetchImpl: FetchImpl = async (_input, init) => {
      body = String(init?.body);
      return jsonResponse({
        access_token: "moxie_new",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "moxr_rotated",
        scope: "context:read",
      });
    };
    const tokens = await refreshAccessToken(
      {
        tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
        refreshToken: "moxr_old",
        clientId: "client-123",
      },
      fetchImpl,
    );
    expect(body).toBe(
      "grant_type=refresh_token&refresh_token=moxr_old&client_id=client-123",
    );
    expect(tokens.access_token).toBe("moxie_new");
    expect(tokens.refresh_token).toBe("moxr_rotated");
  });

  it("maps an error response to a thrown error", async () => {
    const fetchImpl: FetchImpl = async () =>
      jsonResponse(
        { error: "invalid_grant", error_description: "refresh revoked" },
        400,
      );
    await expect(
      refreshAccessToken(
        {
          tokenEndpoint: "https://moxiedocs.com/api/oauth/token",
          refreshToken: "x",
          clientId: "c",
        },
        fetchImpl,
      ),
    ).rejects.toThrow(/refresh revoked/);
  });
});
