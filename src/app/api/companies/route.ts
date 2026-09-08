import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
import { hashPassword } from "@/features/auth/server/password";
import { resolvePermissions } from "@/features/access-control/server/permissions";
import { slugifyCompanyName, SOLUTIONS } from "@/lib/platform";
import { buildCompanyOwnerHandle, ensureHandlePrefix } from "@/lib/company-handle";

const companySignupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companySlug: z.string().trim().min(2).max(80).optional(),
  ownerName: z.string().trim().min(2).max(120),
  handle: z.string().trim().min(2).max(100).optional(),
  password: z.string().min(12).max(200),
  solutionKey: z.string().trim().min(1).max(64),
});

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const ipAddress = getClientIp(req);
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json(
      { error: "برای ساخت شرکت ابتدا با Clerk وارد شوید." },
      { status: 401 }
    );
  }

  try {
    const parsed = companySignupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Company signup data is invalid." }, { status: 400 });
    }

    const solution = SOLUTIONS.find((item) => item.key === parsed.data.solutionKey);
    if (!solution) {
      return NextResponse.json({ error: "Selected solution is not available." }, { status: 400 });
    }

    const companySlug = (parsed.data.companySlug?.trim() || slugifyCompanyName(parsed.data.companyName)) || randomUUID().slice(0, 8);
    const handle = parsed.data.handle?.trim()
      ? ensureHandlePrefix(parsed.data.handle)
      : buildCompanyOwnerHandle(companySlug);

    const existingLinkedMember = await db.member.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (existingLinkedMember) {
      return NextResponse.json(
        { error: "این حساب Clerk قبلاً به یک شرکت وصل شده است." },
        { status: 409 }
      );
    }

    const existingCompany = await db.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
    if (existingCompany) {
      return NextResponse.json({ error: "Company slug already exists." }, { status: 409 });
    }

    const existingHandle = await db.member.findUnique({ where: { handle }, select: { id: true } });
    if (existingHandle) {
      return NextResponse.json({ error: "Handle already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const rawToken = generateSessionToken();
    const { company, owner } = await db.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: {
          name: parsed.data.companyName,
          slug: companySlug,
          selectedSolutionKey: solution.key,
        },
      });
      const createdOwner = await tx.member.create({
        data: {
          name: parsed.data.ownerName,
          handle,
          clerkUserId: userId,
          password: passwordHash,
          role: "SUPER_ADMIN",
          mustChangePassword: false,
          isActive: true,
          companyId: createdCompany.id,
        },
        select: { id: true, name: true, handle: true, role: true, companyId: true, mustChangePassword: true },
      });
      await tx.company.update({
        where: { id: createdCompany.id },
        data: { ownerMemberId: createdOwner.id },
      });
      await tx.session.create({
        data: {
          memberId: createdOwner.id,
          tokenHash: hashSessionToken(rawToken),
          expiresAt: sessionExpiresAt(),
          ipAddress,
          userAgent: req.headers.get("user-agent")?.slice(0, 500) || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: createdOwner.id,
          action: "COMPANY_CREATE",
          entityType: "Company",
          entityId: createdCompany.id,
          result: "SUCCESS",
          requestId,
          ipAddress,
          metadata: { solutionKey: solution.key },
        },
      });
      return { company: createdCompany, owner: createdOwner };
    });

    const response = NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        selectedSolutionKey: company.selectedSolutionKey,
      },
      member: {
        id: owner.id,
        name: owner.name,
        handle: owner.handle,
        role: owner.role,
        companyId: owner.companyId,
        companyName: company.name,
        companySlug: company.slug,
        selectedSolutionKey: company.selectedSolutionKey,
        mustChangePassword: owner.mustChangePassword,
        permissions: resolvePermissions(owner.role, []),
      },
    });
    response.cookies.set(SESSION_COOKIE, rawToken, sessionCookieOptions(req));
    return response;
  } catch (error) {
    console.error("Company signup error:", { requestId, error });
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
