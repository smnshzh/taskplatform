import { describe, expect, it } from "vitest";
import {
  buildCompanyMemberHandle,
  buildCompanyOwnerHandle,
  ensureHandlePrefix,
} from "@/lib/company-handle";

describe("company handle generation", () => {
  it("builds the company owner handle from the company slug", () => {
    expect(buildCompanyOwnerHandle("namecompany")).toBe("@namecompany@user");
  });

  it("builds the company member handle from the company slug and name", () => {
    expect(buildCompanyMemberHandle("namecompany", "Ali Rahimi")).toBe(
      "@namecompany@usercompany-ali-rahimi"
    );
  });

  it("normalizes handles with or without the leading @", () => {
    expect(ensureHandlePrefix("namecompany@user")).toBe("@namecompany@user");
    expect(ensureHandlePrefix("@namecompany@user")).toBe("@namecompany@user");
  });
});
