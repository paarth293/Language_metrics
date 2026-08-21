import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { generate, generateSecret, generateURI, verify } from "otplib";
import bcrypt from "bcryptjs";

/**
 * Encrypt TOTP secrets at rest with AES-256-GCM.
 * Key material is derived from JWT_SECRET (or TOTP_ENCRYPTION_KEY if set).
 */
function encryptionKey(): Buffer {
  const material =
    process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  if (!material) {
    throw new Error("JWT_SECRET (or TOTP_ENCRYPTION_KEY) required for TOTP");
  }
  return createHash("sha256").update(material).digest();
}

/** Returns base64(iv + authTag + ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
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
