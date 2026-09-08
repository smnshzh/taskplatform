import { compare, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const BCRYPT_PREFIX = /^\$2[aby]\$/;

export function isPasswordHash(value: string): boolean {
  return BCRYPT_PREFIX.test(value);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  storedPassword: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (isPasswordHash(storedPassword)) {
    return {
      valid: await compare(password, storedPassword),
      needsUpgrade: false,
    };
  }

  return {
    valid: password === storedPassword,
    needsUpgrade: password === storedPassword,
  };
}
