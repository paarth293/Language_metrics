import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, compareOtp } from "./otp";

describe("OTP Utilities", () => {
  describe("generateOtp", () => {
    it("should generate a 6-digit numeric string", () => {
      const otp = generateOtp();
      expect(typeof otp).toBe("string");
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should generate OTPs in the range 100000–999999", () => {
      // Run multiple times to verify range
      for (let i = 0; i < 50; i++) {
        const otp = generateOtp();
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });

    it("should generate unique OTPs across calls", () => {
      const otps = new Set<string>();
      for (let i = 0; i < 20; i++) {
        otps.add(generateOtp());
      }
      // With 900,000 possible values, 20 should almost certainly be unique
      expect(otps.size).toBeGreaterThanOrEqual(15);
    });
  });

  describe("hashOtp", () => {
    it("should return a bcrypt hash string", async () => {
      const hash = await hashOtp("123456");
      expect(typeof hash).toBe("string");
      // bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it("should produce different hashes for different OTPs", async () => {
      const hash1 = await hashOtp("123456");
      const hash2 = await hashOtp("654321");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hashes for the same OTP (salt variation)", async () => {
      const hash1 = await hashOtp("123456");
      const hash2 = await hashOtp("123456");
      // bcrypt uses random salt, so same input → different hash
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("compareOtp", () => {
    it("should return true for a correct OTP", async () => {
      const otp = "567890";
      const hash = await hashOtp(otp);
      const result = await compareOtp(otp, hash);
      expect(result).toBe(true);
    });

    it("should return false for an incorrect OTP", async () => {
      const hash = await hashOtp("123456");
      const result = await compareOtp("000000", hash);
      expect(result).toBe(false);
    });

    it("should return false for empty OTP against a valid hash", async () => {
      const hash = await hashOtp("123456");
      const result = await compareOtp("", hash);
      expect(result).toBe(false);
    });

    it("should work with generated OTPs end-to-end", async () => {
      const otp = generateOtp();
      const hash = await hashOtp(otp);

      // Correct OTP matches
      expect(await compareOtp(otp, hash)).toBe(true);

      // Wrong OTP does not match
      const wrongOtp = otp === "123456" ? "654321" : "123456";
      expect(await compareOtp(wrongOtp, hash)).toBe(false);
    });
  });
});
