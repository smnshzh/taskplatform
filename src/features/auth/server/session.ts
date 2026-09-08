import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

type RequestSecurityContext = {
  headers: { get(name: string): string | null };
  nextUrl: { protocol: string };
};

export function shouldUseSecureCookie(
  request?: RequestSecurityContext
): boolean {
  const forwardedProto = request?.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto) return forwardedProto === "https";
  if (request) return request.nextUrl.protocol === "https:";

  try {
    return new URL(process.env.APP_BASE_URL || "").protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(request?: RequestSecurityContext) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
