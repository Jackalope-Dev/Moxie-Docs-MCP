import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { moxieMcpServerInfo } from "./interface/server-info";
import { PACKAGE_VERSION } from "./version";

const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, unknown>;

// package.json is the single source of truth: clients compare serverInfo.version
// with the MCP Registry entry to decide when to refresh, so they must agree.
describe("version", () => {
  const packageVersion = readJson("../package.json").version;

  it("reports package.json's version as serverInfo.version", () => {
    expect(PACKAGE_VERSION).toBe(packageVersion);
    expect(moxieMcpServerInfo.version).toBe(packageVersion);
  });

  it("publishes the same version to the MCP Registry", () => {
    const serverJson = readJson("../server.json");
    expect(serverJson.version).toBe(packageVersion);
  });

  it("keeps the plugin manifests on the same version", () => {
    expect(readJson("../lhm.plugin.json").version).toBe(packageVersion);
    expect(readJson("../.claude-plugin/plugin.json").version).toBe(packageVersion);
    const marketplace = readJson("../.claude-plugin/marketplace.json") as {
      plugins: Array<{ version: string }>;
    };
    expect(marketplace.plugins.map((plugin) => plugin.version)).toEqual([packageVersion]);
  });
});
