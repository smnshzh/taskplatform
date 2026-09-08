import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  hashSessionToken,
  sessionCookieOptions,
} from "@/features/auth/server/session";

export async function POST(request: NextRequest) {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      await db.session.updateMany({
        where: {
          tokenHash: hashSessionToken(token),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      ...sessionCookieOptions(request),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
