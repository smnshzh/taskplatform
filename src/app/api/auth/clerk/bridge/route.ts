import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { CONSOLE_SETUP_COOKIE } from "@/lib/console-setup";
import {
  generateSessionToken,
  getClientIp,
  hashSessionToken,
  sessionCookieOptions,
  sessionExpiresAt,
} from "@/features/auth/server/session";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const requestedReturnTo = new URL(req.url).searchParams.get("returnTo") || "/console";
  const returnTo = requestedReturnTo.startsWith("/") ? requestedReturnTo : "/console";

  try {
    const { isAuthenticated, userId } = await auth();

    if (!isAuthenticated || !userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const member = await db.member.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        name: true,
        handle: true,
        role: true,
        companyId: true,
        groupId: true,
        mustChangePassword: true,
        company: { select: { id: true, name: true, slug: true, selectedSolutionKey: true } },
        group: { select: { name: true } },
        accessGroups: { include: { accessGroup: { select: { id: true, name: true, permissions: true } } } },
      },
    });

    if (!member) {
      const response = NextResponse.redirect(new URL("/console", req.url));
      response.cookies.set(CONSOLE_SETUP_COOKIE, "1", {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 15,
      });
      return response;
    }

    const rawToken = generateSessionToken();
    await db.$transaction([
      db.session.create({
        data: {
          memberId: member.id,
          tokenHash: hashSessionToken(rawToken),
          expiresAt: sessionExpiresAt(),
          ipAddress: getClientIp(req),
          userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
        },
      }),
      db.member.update({
        where: { id: member.id },
        data: { lastLoginAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorId: member.id,
          action: "LOGIN",
          entityType: "Member",
          entityId: member.id,
          result: "SUCCESS",
          requestId,
          metadata: { via: "clerk-bridge" },
        },
      }),
    ]);

    const response = NextResponse.redirect(new URL(returnTo, req.url));
    response.cookies.set(SESSION_COOKIE, rawToken, sessionCookieOptions(req));
    response.cookies.set(CONSOLE_SETUP_COOKIE, "", {
      path: "/",
      sameSite: "lax",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Clerk bridge error:", { requestId, error });
    const response = NextResponse.redirect(new URL("/console", req.url));
    response.cookies.set(CONSOLE_SETUP_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 15,
    });
    return response;
  }
}
