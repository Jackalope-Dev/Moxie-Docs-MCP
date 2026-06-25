import { spawn } from "node:child_process";

/**
 * Best-effort cross-platform browser launcher.
 *
 * Returns whether the launch command was spawned successfully so callers can
 * fall back to printing the URL when no browser could be opened (e.g. headless
 * or remote shells). Never throws.
 */
export function openBrowser(url: string): boolean {
  try {
    let command: string;
    let args: string[];

    if (process.platform === "win32") {
      // `start` is a cmd builtin; the first quoted arg is the window title.
      command = "cmd";
      args = ["/c", "start", "", url];
    } else if (process.platform === "darwin") {
      command = "open";
      args = [url];
    } else {
      command = "xdg-open";
      args = [url];
    }

    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
    });
    child.on("error", () => {
      // swallow — caller falls back to printing the URL
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
