import { describe, expect, it } from "vitest";
import {
  moxieMcpCapabilities,
  moxieMcpProtocolVersion,
  moxieMcpServerInfo,
} from "./server-info";
import { PACKAGE_VERSION } from "../version";

describe("server info", () => {
  it("reports the protocol version and server identity", () => {
    expect(moxieMcpProtocolVersion).toBe("2025-06-18");
    expect(moxieMcpServerInfo).toEqual({ name: "moxie-docs", version: PACKAGE_VERSION });
  });

  it("advertises tools, resources, and prompts capabilities", () => {
    expect(moxieMcpCapabilities).toEqual({
      tools: {},
      resources: {},
      prompts: {},
    });
  });
});
