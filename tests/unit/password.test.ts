import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from "@/features/auth/server/password";

describe("password security", () => {
  it("hashes and verifies passwords without retaining plaintext", async () => {
    const password = "A-strong-test-password";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(isPasswordHash(passwordHash)).toBe(true);
    await expect(verifyPassword(password, passwordHash)).resolves.toEqual({
      valid: true,
      needsUpgrade: false,
    });
    await expect(verifyPassword("wrong", passwordHash)).resolves.toEqual({
      valid: false,
      needsUpgrade: false,
    });
  });

  it("recognizes a valid legacy password as requiring an upgrade", async () => {
    await expect(verifyPassword("legacy", "legacy")).resolves.toEqual({
      valid: true,
      needsUpgrade: true,
    });
  });
});
