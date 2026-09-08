import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  generateSessionToken,
  getClientIp,
  hashSessionToken,
  sessionCookieOptions,
  sessionExpiresAt,
} from "@/features/auth/server/session";
import {
  hashPassword,
  verifyPassword,
} from "@/features/auth/server/password";
import { resolvePermissions } from "@/features/access-control/server/permissions";

const loginSchema = z.object({
  handle: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const ipAddress = getClientIp(req);

  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "هندل و رمز عبور معتبر الزامی است." },
        { status: 400 }
      );
    }

    const rawHandle = parsed.data.handle;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const password = parsed.data.password;
    const since = new Date(Date.now() - LOGIN_WINDOW_MS);
    const failedAttempts = await db.loginAttempt.count({
      where: {
        successful: false,
        createdAt: { gte: since },
        OR: [
          { handle },
          ...(ipAddress ? [{ ipAddress }] : []),
        ],
      },
    });

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await db.auditLog.create({
        data: {
          action: "LOGIN_RATE_LIMITED",
          result: "DENIED",
          requestId,
          ipAddress,
        },
      });
      return NextResponse.json(
        { error: "تعداد تلاش‌ها بیش از حد مجاز است. بعداً دوباره تلاش کنید." },
        { status: 429 }
      );
    }

    const member = await db.member.findUnique({
      where: { handle },
      select: {
        id: true,
        name: true,
        handle: true,
        password: true,
        role: true,
        companyId: true,
        groupId: true,
        supervisorId: true,
        mustChangePassword: true,
        isActive: true,
        company: { select: { id: true, name: true, slug: true, selectedSolutionKey: true } },
        group: { select: { name: true } },
        accessGroups: { include: { accessGroup: { select: { id: true, name: true, permissions: true } } } },
      },
    });

    const verification = member
      ? await verifyPassword(password, member.password)
      : { valid: false, needsUpgrade: false };

    if (!member || !verification.valid || !member.isActive) {
      await db.$transaction([
        db.loginAttempt.create({
          data: { handle, ipAddress, successful: false },
        }),
        db.auditLog.create({
          data: {
            actorId: member?.id,
            action: "LOGIN",
            entityType: "Member",
            entityId: member?.id,
            result: "FAILED",
            requestId,
            ipAddress,
          },
        }),
      ]);
      return NextResponse.json(
        { error: "هندل یا رمز عبور نادرست است." },
        { status: 401 }
      );
    }

    const rawToken = generateSessionToken();
    const upgradedPassword = verification.needsUpgrade
      ? await hashPassword(password)
      : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

    await db.$transaction([
      db.member.update({
        where: { id: member.id },
        data: {
          lastLoginAt: new Date(),
          ...(upgradedPassword ? { password: upgradedPassword } : {}),
        },
      }),
      db.session.create({
        data: {
          memberId: member.id,
          tokenHash: hashSessionToken(rawToken),
          expiresAt: sessionExpiresAt(),
          ipAddress,
          userAgent,
        },
      }),
      db.loginAttempt.create({
        data: { handle, ipAddress, successful: true },
      }),
      db.auditLog.create({
        data: {
          actorId: member.id,
          action: "LOGIN",
          entityType: "Member",
          entityId: member.id,
          result: "SUCCESS",
          requestId,
          ipAddress,
          metadata: verification.needsUpgrade
            ? { passwordHashUpgraded: true }
            : undefined,
        },
      }),
    ]);

    const response = NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        handle: member.handle,
        role: member.role,
        companyId: member.companyId,
        companyName: member.company?.name ?? null,
        companySlug: member.company?.slug ?? null,
        selectedSolutionKey: member.company?.selectedSolutionKey ?? null,
        groupId: member.groupId,
        groupName: member.group?.name ?? null,
        supervisorId: member.supervisorId,
        mustChangePassword: member.mustChangePassword,
        permissions: resolvePermissions(member.role, member.accessGroups.flatMap(({ accessGroup }) => accessGroup.permissions)),
        accessGroups: member.accessGroups.map(({ accessGroup }) => ({ id: accessGroup.id, name: accessGroup.name })),
      },
    });
    response.cookies.set(
      SESSION_COOKIE,
      rawToken,
      sessionCookieOptions(req)
    );
    return response;
  } catch (error) {
    console.error("Login error:", { requestId, error });
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
