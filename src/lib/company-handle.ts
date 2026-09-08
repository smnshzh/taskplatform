import { slugifyCompanyName } from "@/lib/platform";

function normalizeHandleSegment(value: string) {
  return slugifyCompanyName(value).replace(/^-+|-+$/g, "");
}

export function buildCompanyOwnerHandle(companySlug: string) {
  const companyPart = normalizeHandleSegment(companySlug) || "company";
  return `@${companyPart}@user`;
}

export function buildCompanyMemberHandle(companySlug: string, memberName: string) {
  const companyPart = normalizeHandleSegment(companySlug) || "company";
  const memberPart = normalizeHandleSegment(memberName);
  return memberPart ? `@${companyPart}@usercompany-${memberPart}` : `@${companyPart}@usercompany`;
}

export function ensureHandlePrefix(handle: string) {
  const trimmed = handle.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
