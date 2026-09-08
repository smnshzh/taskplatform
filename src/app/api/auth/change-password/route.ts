import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/features/auth/server/password";
import { hashSessionToken } from "@/features/auth/server/session";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "رمز عبور جدید باید متفاوت باشد.",
    path: ["newPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const member = await requireAuth();
    const parsed = changePasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "رمز عبور نامعتبر است." },
        { status: 400 }
      );
    }

    const credential = await db.member.findUnique({
      where: { id: member.id },
      select: { password: true },
    });
    if (!credential) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    const verification = await verifyPassword(
      parsed.data.currentPassword,
      credential.password
    );
    if (!verification.valid) {
      return NextResponse.json(
        { error: "رمز عبور فعلی نادرست است." },
        { status: 401 }
      );
    }

    const store = await cookies();
    const currentToken = store.get(SESSION_COOKIE)?.value;
    const currentTokenHash = currentToken
      ? hashSessionToken(currentToken)
      : "__none__";
    const passwordHash = await hashPassword(parsed.data.newPassword);

    await db.$transaction([
      db.member.update({
        where: { id: member.id },
        data: { password: passwordHash, mustChangePassword: false },
      }),
      db.session.updateMany({
        where: {
          memberId: member.id,
          revokedAt: null,
          tokenHash: { not: currentTokenHash },
        },
        data: { revokedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorId: member.id,
          action: "PASSWORD_CHANGE",
          entityType: "Member",
          entityId: member.id,
          result: "SUCCESS",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }
}
