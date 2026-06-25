import { MOXIE_MCP_ENDPOINT } from "../interface/skill";
import type { FetchImpl } from "./oauth";

/**
 * A connected repository as reported by the MCP endpoint status check.
 */
export interface McpRepository {
  id: string;
  fullName: string;
}

/**
 * Result of a `GET ${MOXIE_MCP_ENDPOINT}` status/smoke check.
 */
export interface McpStatus {
  ok: boolean;
  scope: string;
  repositories: McpRepository[];
  tools: number;
}

interface RawMcpStatus {
  ok?: unknown;
  scope?: unknown;
  repositories?: unknown;
  tools?: unknown;
}

/**
 * Hit the MCP endpoint with a Bearer access token and normalize the status
 * payload. Throws on a non-OK HTTP response so callers can surface auth/network
 * failures distinctly from an empty-but-valid account.
 */
export async function fetchMcpStatus(
  accessToken: string,
  fetchImpl: FetchImpl = fetch,
): Promise<McpStatus> {
  const response = await fetchImpl(MOXIE_MCP_ENDPOINT, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `MCP endpoint returned ${response.status} ${response.statusText}.`,
    );
  }

  const raw = (await response.json()) as RawMcpStatus;

  const repositories: McpRepository[] = Array.isArray(raw.repositories)
    ? raw.repositories
        .map((entry): McpRepository | null => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const obj = entry as { id?: unknown; fullName?: unknown };
          const id = typeof obj.id === "string" ? obj.id : String(obj.id ?? "");
          const fullName =
            typeof obj.fullName === "string" ? obj.fullName : "";
          if (!fullName) {
            return null;
          }
          return { id, fullName };
        })
        .filter((r): r is McpRepository => r !== null)
    : [];

  return {
    ok: raw.ok === true,
    scope: typeof raw.scope === "string" ? raw.scope : "",
    repositories,
    tools:
      typeof raw.tools === "number"
        ? raw.tools
        : Array.isArray(raw.tools)
          ? raw.tools.length
          : 0,
  };
}
