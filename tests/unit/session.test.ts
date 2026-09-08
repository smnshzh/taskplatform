import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
  shouldUseSecureCookie,
} from "@/features/auth/server/session";

describe("session security", () => {
  it("creates unguessable tokens and only stores deterministic hashes", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(hashSessionToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).not.toContain(first);
  });

  it("uses a bounded expiration", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    expect(sessionExpiresAt(now).toISOString()).toBe(
      "2026-07-27T00:00:00.000Z"
    );
  });

  it("uses Secure only when the client transport is HTTPS", () => {
    const context = (protocol: string, forwardedProto?: string) => ({
      nextUrl: { protocol },
      headers: {
        get: (name: string) =>
          name === "x-forwarded-proto" ? forwardedProto || null : null,
      },
    });

    expect(shouldUseSecureCookie(context("http:"))).toBe(false);
    expect(shouldUseSecureCookie(context("https:"))).toBe(true);
    expect(shouldUseSecureCookie(context("http:", "https"))).toBe(true);
    expect(shouldUseSecureCookie(context("https:", "http"))).toBe(false);
  });
});
