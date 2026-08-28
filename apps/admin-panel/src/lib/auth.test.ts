/**
 * @vitest-environment node
 *
 * This file uses real RS256 crypto (jose) so it requires the Node.js
 * environment — jsdom does not provide WebCrypto.subtle which jose
 * needs for RS256 signing/verification.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { signSession, verifySession } from "./auth";

let rawPrivatePem: string;
let rawPublicPem: string;

beforeAll(async () => {
  const { generateKeyPair } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const generate = promisify(generateKeyPair);

  const { privateKey, publicKey } = await generate("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  rawPrivatePem = privateKey;
  rawPublicPem = publicKey;
});

describe("auth JWT handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const payload = {
    sub: "user-123",
    email: "admin@example.com",
    roleKey: "admin",
    isSuperAdmin: false,
  };

  it("throws when JWT_PRIVATE_KEY is missing", async () => {
    vi.stubEnv("JWT_PRIVATE_KEY", "");
    await expect(signSession(payload)).rejects.toThrow(/JWT_PRIVATE_KEY is not set/);
  });

  it("successfully signs and verifies a token with RSA keys", async () => {
    vi.stubEnv("JWT_PRIVATE_KEY", rawPrivatePem);
    vi.stubEnv("JWT_PUBLIC_KEY", rawPublicPem);

    const token = await signSession(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const decoded = await verifySession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(payload.sub);
    expect(decoded?.email).toBe(payload.email);
    expect(decoded?.roleKey).toBe(payload.roleKey);
    expect(decoded?.isSuperAdmin).toBe(payload.isSuperAdmin);
  });

  it("returns null for tampered tokens", async () => {
    vi.stubEnv("JWT_PRIVATE_KEY", rawPrivatePem);
    vi.stubEnv("JWT_PUBLIC_KEY", rawPublicPem);

    const token = await signSession(payload);
    const result = await verifySession(token + "tampered");
    expect(result).toBeNull();
  });

  it("returns null for tokens signed with a different key", async () => {
    const { generateKeyPair } = await import("node:crypto");
    const { promisify } = await import("node:util");
    const generate = promisify(generateKeyPair);

    const { privateKey: otherKey } = await generate("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    vi.stubEnv("JWT_PRIVATE_KEY", otherKey);
    vi.stubEnv("JWT_PUBLIC_KEY", rawPublicPem);

    const token = await signSession(payload);
    const result = await verifySession(token);
    expect(result).toBeNull();
  });
});
