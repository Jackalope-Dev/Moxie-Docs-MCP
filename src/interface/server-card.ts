import { moxieMcpPrompts } from "./prompts";
import {
  moxieMcpCapabilities,
  moxieMcpProtocolVersion,
  moxieMcpServerInfo,
} from "./server-info";
import { MOXIE_MCP_DOCS_URL, MOXIE_MCP_ENDPOINT, MOXIE_SITE_URL } from "./skill";
import { moxieMcpTools } from "./tools";

/**
 * JSON-RPC methods callable without a Moxie Docs MCP token.
 * Catalog listing is public; tool execution requires auth.
 */
export const moxieMcpPublicMethods = [
  "initialize",
  "tools/list",
  "prompts/list",
] as const;

export type MoxieMcpPublicMethod = (typeof moxieMcpPublicMethods)[number];

export type MoxieMcpServerCard = {
  serverInfo: typeof moxieMcpServerInfo;
  protocolVersion: typeof moxieMcpProtocolVersion;
  transport: {
    type: "streamable-http";
    endpoint: string;
  };
  capabilities: typeof moxieMcpCapabilities;
  authorization: {
    protectedResourceMetadata: string;
    authorizationServerMetadata: string;
  };
  documentation: string;
  publicMethods: MoxieMcpPublicMethod[];
  tools: typeof moxieMcpTools;
  prompts: typeof moxieMcpPrompts;
};

export function buildMoxieMcpServerCard(
  overrides: {
    endpoint?: string;
    protectedResourceMetadata?: string;
    authorizationServerMetadata?: string;
    documentation?: string;
  } = {},
): MoxieMcpServerCard {
  const site = MOXIE_SITE_URL.replace(/\/$/, "");

  return {
    serverInfo: moxieMcpServerInfo,
    protocolVersion: moxieMcpProtocolVersion,
    transport: {
      type: "streamable-http",
      endpoint: overrides.endpoint ?? MOXIE_MCP_ENDPOINT,
    },
    capabilities: moxieMcpCapabilities,
    authorization: {
      protectedResourceMetadata:
        overrides.protectedResourceMetadata ??
        `${site}/.well-known/oauth-protected-resource`,
      authorizationServerMetadata:
        overrides.authorizationServerMetadata ??
        `${site}/.well-known/oauth-authorization-server`,
    },
    documentation: overrides.documentation ?? MOXIE_MCP_DOCS_URL,
    publicMethods: [...moxieMcpPublicMethods],
    tools: moxieMcpTools,
    prompts: moxieMcpPrompts,
  };
}

/** Canonical server card served from `/.well-known/mcp/server-card.json`. */
export const moxieMcpServerCard = buildMoxieMcpServerCard();