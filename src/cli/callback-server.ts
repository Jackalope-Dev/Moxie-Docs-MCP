import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Local loopback HTTP server that receives the OAuth redirect.
 *
 * Security:
 * - Binds to 127.0.0.1 only (never 0.0.0.0) so no other host can reach it.
 * - Validates the `state` parameter against the value we generated (CSRF
 *   guard); a mismatch is rejected and answered with HTTP 400.
 * - Never logs the authorization code or any token.
 */

const DEFAULT_TIMEOUT_MS = 300_000;

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Moxie Docs — signed in</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #05091a; color: #f3f4f6; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { text-align: center; padding: 2.5rem 3rem; }
  .mark { font-size: 2.5rem; }
  h1 { font-size: 1.4rem; margin: 1rem 0 0.5rem; }
  p { color: #9ca3af; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">&#10003;</div>
    <h1>You're signed in to Moxie Docs</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Moxie Docs — sign-in failed</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #05091a; color: #f3f4f6; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { text-align: center; padding: 2.5rem 3rem; }
  .mark { font-size: 2.5rem; color: #f87171; }
  h1 { font-size: 1.4rem; margin: 1rem 0 0.5rem; }
  p { color: #9ca3af; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">&#10007;</div>
    <h1>Sign-in could not be completed</h1>
    <p>Return to your terminal for details.</p>
  </div>
</body>
</html>`;

export interface CallbackResult {
  code: string;
}

export interface CallbackServer {
  /** The ephemeral port the loopback server is bound to. */
  port: number;
  /** The full redirect URI to register and use in the authorize request. */
  redirectUri: string;
  /**
   * Resolve once a valid `/callback?code=&state=` arrives with matching state.
   * Rejects on state mismatch, on an `?error=` callback, or on timeout. The
   * server is always closed before this settles.
   */
  waitForCode: (timeoutMs?: number) => Promise<CallbackResult>;
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
}

/**
 * Start a loopback callback server bound to 127.0.0.1 on an ephemeral port.
 */
export async function startCallbackServer({
  expectedState,
}: {
  expectedState: string;
}): Promise<CallbackServer> {
  let settled = false;
  // The outcome is stored rather than pushed onto an eager promise so a
  // callback that arrives before `waitForCode` (or any rejection) never
  // surfaces as an unhandled rejection — `waitForCode` is the sole consumer.
  let outcome: { code?: CallbackResult; error?: Error } | null = null;
  let onSettle: (() => void) | null = null;

  function settle(value: { code?: CallbackResult; error?: Error }): void {
    if (settled) return;
    settled = true;
    outcome = value;
    onSettle?.();
  }

  const resolveCode = (result: CallbackResult): void => settle({ code: result });
  const rejectCode = (error: Error): void => settle({ error });

  const server: Server = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      const requestUrl = new URL(
        req.url ?? "/",
        "http://127.0.0.1",
      );

      if (requestUrl.pathname !== "/callback") {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      if (error) {
        const description =
          requestUrl.searchParams.get("error_description") ?? error;
        sendHtml(res, 400, ERROR_HTML);
        rejectCode(new Error(`Authorization denied: ${description}`));
        return;
      }

      const state = requestUrl.searchParams.get("state");
      if (state !== expectedState) {
        // CSRF guard: do not accept a code under an unexpected state.
        sendHtml(res, 400, ERROR_HTML);
        rejectCode(
          new Error("OAuth state mismatch; rejecting callback (possible CSRF)."),
        );
        return;
      }

      const code = requestUrl.searchParams.get("code");
      if (!code) {
        sendHtml(res, 400, ERROR_HTML);
        rejectCode(new Error("Authorization callback was missing a code."));
        return;
      }

      sendHtml(res, 200, SUCCESS_HTML);
      resolveCode({ code });
    },
  );

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // 127.0.0.1 only — never bind to all interfaces.
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const port = address.port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  function closeServer(): void {
    try {
      server.close();
    } catch {
      // already closing
    }
  }

  function waitForCode(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CallbackResult> {
    return new Promise<CallbackResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        rejectCode(
          new Error(
            `Timed out after ${Math.round(
              timeoutMs / 1000,
            )}s waiting for the authorization redirect.`,
          ),
        );
      }, timeoutMs);
      if (typeof timeout.unref === "function") {
        timeout.unref();
      }

      const deliver = (): void => {
        clearTimeout(timeout);
        closeServer();
        if (outcome?.error) {
          reject(outcome.error);
        } else if (outcome?.code) {
          resolve(outcome.code);
        }
      };

      if (settled) {
        deliver();
      } else {
        onSettle = deliver;
      }
    });
  }

  return { port, redirectUri, waitForCode };
}
