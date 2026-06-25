import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the command modules so routing is tested without real side effects.
const loginRun = vi.fn(async () => {});
const statusRun = vi.fn(async () => {});
vi.mock("./commands/login", () => ({ run: loginRun }));
vi.mock("./commands/status", () => ({ run: statusRun }));
vi.mock("./commands/setup", () => ({ run: vi.fn(async () => {}) }));
vi.mock("./commands/logout", () => ({ run: vi.fn(async () => {}) }));
vi.mock("./commands/config", () => ({ run: vi.fn(async () => {}) }));
vi.mock("./commands/install-skill", () => ({ run: vi.fn(async () => {}) }));

let out: string[];
let err: string[];

beforeEach(async () => {
  out = [];
  err = [];
  loginRun.mockClear();
  statusRun.mockClear();
  process.exitCode = undefined;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    err.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function importRoute() {
  return import("./cli");
}

describe("route", () => {
  it("dispatches a known command with its args", async () => {
    const { route } = await importRoute();
    const code = await route(["login", "--no-browser"]);
    expect(code).toBe(0);
    expect(loginRun).toHaveBeenCalledWith(["--no-browser"]);
  });

  it("dispatches status", async () => {
    const { route } = await importRoute();
    await route(["status"]);
    expect(statusRun).toHaveBeenCalledOnce();
  });

  it("prints help and exits 0 with no command", async () => {
    const { route } = await importRoute();
    const code = await route([]);
    expect(code).toBe(0);
    expect(out.join("")).toContain("Usage: moxie-docs");
  });

  it("--help lists the commands", async () => {
    const { route } = await importRoute();
    const code = await route(["--help"]);
    expect(code).toBe(0);
    const text = out.join("");
    for (const name of ["setup", "login", "logout", "status", "config", "install-skill"]) {
      expect(text).toContain(name);
    }
  });

  it("--version prints the version", async () => {
    const { route } = await importRoute();
    const code = await route(["--version"]);
    expect(code).toBe(0);
    expect(out.join("").trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("returns nonzero for an unknown command", async () => {
    const { route } = await importRoute();
    const code = await route(["frobnicate"]);
    expect(code).toBe(1);
    expect(err.join("")).toContain("Unknown command");
  });

  it("returns nonzero when a command throws", async () => {
    loginRun.mockRejectedValueOnce(new Error("boom"));
    const { route } = await importRoute();
    const code = await route(["login"]);
    expect(code).toBe(1);
    expect(err.join("")).toContain("boom");
  });

  it("exposes COMMAND_NAMES", async () => {
    const { COMMAND_NAMES } = await importRoute();
    expect(COMMAND_NAMES).toContain("setup");
    expect(COMMAND_NAMES).toContain("install-skill");
  });
});
