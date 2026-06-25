import { describe, expect, it } from "vitest";
import {
  computeCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./pkce";

describe("computeCodeChallenge", () => {
  it("matches the RFC 7636 Appendix B test vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(computeCodeChallenge(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("produces unpadded base64url", () => {
    const challenge = computeCodeChallenge(generateCodeVerifier());
    expect(challenge).not.toContain("=");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
  });
});

describe("generateCodeVerifier", () => {
  it("is ~43 chars in the unreserved charset", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("is random across calls", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe("generateState", () => {
  it("is random base64url", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(generateState()).not.toBe(state);
  });
});
