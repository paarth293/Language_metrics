import { describe, it, expect } from "vitest";
import { generateEmailOTP, hashOTP } from "./otp";

describe("OTP Utilities", () => {
  describe("generateEmailOTP", () => {
    it("should generate a 6-digit numeric string", () => {
      const otp = generateEmailOTP();
      expect(typeof otp).toBe("string");
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should generate unique OTPs", () => {
      const otp1 = generateEmailOTP();
      const otp2 = generateEmailOTP();
      // Extremely low probability of collision
      expect(otp1).not.toBe(otp2);
    });
  });

  describe("hashOTP", () => {
    it("should hash an OTP deterministically", () => {
      const otp = "123456";
      const hash1 = hashOTP(otp);
      const hash2 = hashOTP(otp);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("should hash different OTPs to different values", () => {
      const hash1 = hashOTP("123456");
      const hash2 = hashOTP("654321");
      expect(hash1).not.toBe(hash2);
    });
  });
});
