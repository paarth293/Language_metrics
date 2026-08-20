import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// bcrypt is intentionally slow (cost factor 12) to resist offline brute-force
// of any leaked password-hash column.

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
