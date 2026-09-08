import { describe, expect, it } from "vitest";
import { hasPermission, resolvePermissions } from "../../src/features/access-control/server/permissions";

describe("access permissions", () => {
  it("preserves role permissions", () => expect(hasPermission("MANAGER", [], "member:create")).toBe(true));
  it("shows the groups management report to managers", () => expect(hasPermission("MANAGER", [], "panel:groups")).toBe(true));
  it("keeps the groups management report hidden from non-managers", () => expect(hasPermission("SPECIALIST", [], "panel:groups")).toBe(false));
  it("adds group permissions to a specialist", () => expect(hasPermission("SPECIALIST", ["member:create"], "member:create")).toBe(true));
  it("ignores unknown permissions", () => expect(resolvePermissions("SPECIALIST", ["not:real"])).toEqual(resolvePermissions("SPECIALIST")));
  it("gives super admin every registered permission", () => expect(hasPermission("SUPER_ADMIN", [], "access-group:manage")).toBe(true));
  it("allows every active role to create tasks", () => expect(hasPermission("SPECIALIST", [], "task:create")).toBe(true));
});
