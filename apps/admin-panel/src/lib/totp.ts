import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { generate, generateSecret, generateURI, verify } from "otplib";
import bcrypt from "bcryptjs";

/**
 * Encrypt TOTP secrets at rest with AES-256-GCM.
 * Key material comes from TOTP_ENCRYPTION_KEY.
 *
 * Fix (errors.md #N8): this used to fall back to `process.env.JWT_SECRET`,
 * but this app signs sessions with RS256 keypairs (JWT_PRIVATE_KEY /
 * JWT_PUBLIC_KEY — see lib/auth.ts) and never defines a `JWT_SECRET`
 * anywhere. That made the fallback pure dead code that could never actually
 * supply key material — so any admin enabling 2FA without
 * TOTP_ENCRYPTION_KEY explicitly set would hit this throw on the very first
 * encrypt/verify call (2FA setup, or every login afterwards), with an error
 * message that pointed at a variable the rest of the codebase doesn't use.
 * Fail with the one variable name that actually works, matching
 * .env.example's guidance to set TOTP_ENCRYPTION_KEY explicitly.
 */
function encryptionKey(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY || "";
  if (!material) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` " +
        "and set it in your environment before enabling 2FA."
    );
  }
  return createHash("sha256").update(material).digest();
}

/** Returns base64(iv + authTag + ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function createTotpSecret(): string {
  return generateSecret();
}

export function totpAuthUri(secret: string, label: string): string {
  return generateURI({
    issuer: "Language Matrix Admin",
    label,
    secret,
  });
}

export async function verifyTotpCode(
  encryptedOrPlainSecret: string,
  token: string,
): Promise<boolean> {
  if (!token || !/^\d{6}$/.test(token)) return false;
  let secret = encryptedOrPlainSecret;
  // Prefer decrypting; fall back to treating value as plaintext (migration)
  try {
    if (encryptedOrPlainSecret.length > 40) {
      secret = decryptSecret(encryptedOrPlainSecret);
    }
  } catch {
    secret = encryptedOrPlainSecret;
  }
  const result = await verify({ secret, token });
  return Boolean(result && (result as { valid?: boolean }).valid !== false);
}

/** Generate 10 single-use backup codes; returns plaintext (show once) + hashes. */
export async function generateBackupCodes(count = 10): Promise<{
  plain: string[];
  hashes: string[];
}> {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(5).toString("hex"); // 10 hex chars
    plain.push(code);
    hashes.push(await bcrypt.hash(code, 10));
  }
  return { plain, hashes };
}

export async function consumeBackupCode(
  code: string,
  hashes: string[],
): Promise<string[] | null> {
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(code, hashes[i]!)) {
      return hashes.filter((_, idx) => idx !== i);
    }
  }
  return null;
}

export async function currentTotp(secret: string): Promise<string> {
  return generate({ secret });
}
