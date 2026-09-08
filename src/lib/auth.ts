import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { MemberWithRelations } from "@/lib/prisma-types";
import { authenticatedMemberSelect, getManagedGroupIds } from "@/lib/prisma-types";
import { hashSessionToken } from "@/features/auth/server/session";
import { memberHasPermission, type PermissionKey } from "@/features/access-control/server/permissions";

export const SESSION_COOKIE =
  process.env.SESSION_COOKIE_NAME?.trim() || "tm_session";

export async function getCurrentMember(): Promise<MemberWithRelations | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      member: { select: authenticatedMemberSelect },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.member.isActive
  ) {
    return null;
  }

  return session.member;
}

// Kept as a compatibility no-op while callers migrate away from cache concerns.
export function invalidateMemberCache(_memberId?: string) {
  return;
}

export async function requireAuth(): Promise<MemberWithRelations> {
  const member = await getCurrentMember();
  if (!member) {
    const err = new Error("UNAUTHORIZED") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return member;
}

export async function requireRole(...roles: string[]): Promise<MemberWithRelations> {
  const member = await requireAuth();
  if (!roles.includes(member.role)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return member;
}

// Get all member IDs that the current member can see (self + subordinates recursively)
// Optimized: single recursive query instead of N+1
export async function getVisibleMemberIds(member: MemberWithRelations): Promise<string[]> {
  if (member.role === "SUPER_ADMIN") {
    // For SUPER_ADMIN, use a lightweight select-only query
    const all = await db.member.findMany({ select: { id: true } });
    return all.map((m) => m.id);
  }

  // MANAGER: see all members in all their managed groups
  if (member.role === "MANAGER") {
    const managedGroupIds = getManagedGroupIds(member);
    if (managedGroupIds.length > 0) {
      const groupMembers = await db.member.findMany({
        where: { groupId: { in: managedGroupIds } },
        select: { id: true },
      });
      return groupMembers.map((m) => m.id);
    }
    // Manager with no groups: only self
    return [member.id];
  }

  // SUPERVISOR: see self + all recursive subordinates
  const ids: string[] = [member.id];

  let currentLevelIds = [member.id];
  while (currentLevelIds.length > 0) {
    const nextLevel = await db.member.findMany({
      where: { supervisorId: { in: currentLevelIds } },
      select: { id: true },
    });
    currentLevelIds = nextLevel.map((m) => m.id);
    if (currentLevelIds.length > 0) {
      ids.push(...currentLevelIds);
    }
  }

  return ids;
}

// Check if member can manage another member
export function canManage(manager: MemberWithRelations, targetRoleId: string): boolean {
  const hierarchy: Record<string, string[]> = {
    SUPER_ADMIN: ["SUPER_ADMIN", "MANAGER", "SUPERVISOR", "SPECIALIST"],
    MANAGER: ["SUPERVISOR", "SPECIALIST"],
    SUPERVISOR: ["SPECIALIST"],
    SPECIALIST: [],
  };
  return hierarchy[manager.role]?.includes(targetRoleId) ?? false;
}

// Check if a member is a manager of a specific group
export function isManagerOfGroup(member: MemberWithRelations, groupId: string): boolean {
  if (member.role === "SUPER_ADMIN") return true;
  if (member.role !== "MANAGER") return false;
  return getManagedGroupIds(member).includes(groupId);
}

// Get group IDs managed by this member (convenience re-export)
export { getManagedGroupIds };

// Type-safe error status check
export function isHttpError(error: unknown, status: number): boolean {
  return error instanceof Error && (error as Error & { status?: number }).status === status;
}

export async function requirePermission(permission: PermissionKey): Promise<MemberWithRelations> {
  const member = await requireAuth();
  if (!memberHasPermission(member, permission)) {
    const err = new Error("FORBIDDEN") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return member;
}

export function getCurrentCompany(member: MemberWithRelations | null | undefined) {
  return member?.company ?? null;
}
