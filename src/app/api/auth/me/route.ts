import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import { getGroupPermissions, resolvePermissions } from "@/features/access-control/server/permissions";

// GET /api/auth/me
export async function GET() {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ member: null }, { status: 401 });
    }
    return NextResponse.json({
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
        supervisorName: member.supervisor?.name ?? null,
        mustChangePassword: member.mustChangePassword,
        permissions: resolvePermissions(member.role, getGroupPermissions(member)),
        accessGroups: member.accessGroups.map(({ accessGroup }) => ({ id: accessGroup.id, name: accessGroup.name })),
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
