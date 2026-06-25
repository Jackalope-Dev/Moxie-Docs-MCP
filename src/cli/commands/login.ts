import { authorizeInteractive } from "../authorize";
import { computeExpiresAt, saveCredentials } from "../credentials";
import { parseArgs, flagBool } from "../args";
import { bold, green, print } from "../ui";

/**
 * `moxie-docs login` — run the interactive OAuth flow and persist credentials.
 * `--no-browser` prints the authorization URL instead of opening a browser.
 *
 * Never prints the access or refresh token.
 */
export async function run(args: string[]): Promise<void> {
  const { flags } = parseArgs(args);
  const openBrowser = !flagBool(flags, "no-browser");

  const result = await authorizeInteractive({
    openBrowser,
    log: (message) => print(message),
  });

  const now = Date.now();
  saveCredentials({
    clientId: result.clientId,
    accessToken: result.tokens.access_token,
    refreshToken: result.tokens.refresh_token,
    expiresAt: computeExpiresAt(result.tokens.expires_in, now),
    tokenEndpoint: result.tokenEndpoint,
    scope: result.tokens.scope,
    obtainedAt: new Date(now).toISOString(),
  });

  print();
  print(`${green("✓")} ${bold("Signed in to Moxie Docs.")}`);
}
