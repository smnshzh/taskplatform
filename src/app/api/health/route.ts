import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHealthResponse } from "@/shared/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(createHealthResponse(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "taskmanager",
        error: "SERVICE_UNAVAILABLE",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
