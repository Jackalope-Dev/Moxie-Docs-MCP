import { clearCredentials, credentialsPath } from "../credentials";
import { green, print } from "../ui";

/**
 * `moxie-docs logout` — delete the stored CLI credentials.
 */
export async function run(_args: string[]): Promise<void> {
  clearCredentials();
  print(`${green("✓")} Signed out. Removed ${credentialsPath()}.`);
}
