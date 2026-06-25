import { MOXIE_SITE_URL } from "../../interface/skill";
import { getFreshCredentials } from "../session";
import { fetchMcpStatus } from "../mcp-check";
import { bold, cyan, dim, green, print } from "../ui";

/**
 * `moxie-docs status` — show the signed-in scope, connected repositories, and
 * tool count by calling the MCP endpoint with a fresh access token.
 */
export async function run(_args: string[]): Promise<void> {
  const creds = await getFreshCredentials();
  if (!creds) {
    print("You are not signed in.");
    print(`Run ${cyan("moxie-docs login")} to sign in.`);
    return;
  }

  const status = await fetchMcpStatus(creds.accessToken);

  print(`${green("✓")} ${bold("Signed in to Moxie Docs.")}`);
  print(`  Scope: ${status.scope || dim("(none)")}`);
  print(`  Tools available: ${String(status.tools)}`);

  if (status.repositories.length === 0) {
    print();
    print("No repositories are connected to this account yet.");
    print(`Connect one at ${cyan(`${MOXIE_SITE_URL}/dashboard`)}.`);
    return;
  }

  print(`  Repositories (${String(status.repositories.length)}):`);
  for (const repo of status.repositories) {
    print(`    - ${repo.fullName}`);
  }
}
