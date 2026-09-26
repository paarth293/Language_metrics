import { describe, it, expect } from "vitest";
import {
  validateLoginBody,
  validateDiscoverQuery,
  validateClassesFilter,
  validateProfileUpdate,
  validateComplaint,
  validateDeviceToken,
  validateNotificationUpdate,
  validateChangePassword,
  validateBookClass,
  validateChatMessage,
} from "./validation";

describe("validation", () => {
  it("validates login body", () => {
    const r1 = validateLoginBody({ email: "  Student@Example.com ", password: "hunter2" });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.data.email).toBe("student@example.com");

    const r2 = validateLoginBody({ email: "not-an-email", password: "x" });
    expect(r2.ok).toBe(false);

    const r3 = validateLoginBody({ email: "a@b.com" });
    expect(r3.ok).toBe(false);

    const r4 = validateLoginBody({ email: "a@b.com", password: "x", role: "ADMIN" });
    expect(r4.ok).toBe(false);

    const r5 = validateLoginBody("not an object");
    expect(r5.ok).toBe(false);
  });

  it("converts the discover page's rupee budget to paise", () => {
    const r1 = validateDiscoverQuery(new URLSearchParams("minRate=200&maxRate=500"));
    expect(r1.ok && [r1.data.minPrice, r1.data.maxPrice]).toEqual([20000, 50000]);

    // minRate alone ("₹1000+") has no upper bound.
    const r2 = validateDiscoverQuery(new URLSearchParams("minRate=1000"));
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.data.maxPrice).toBeGreaterThan(100000);
  });

  it("validates discover experience against the enum", () => {
    const r1 = validateDiscoverQuery(new URLSearchParams("experience=fresher"));
    expect(r1.ok && r1.data.experience).toBe("FRESHER");

    const r2 = validateDiscoverQuery(new URLSearchParams("experience=EXPERT"));
    expect(r2.ok).toBe(false);
  });

  it("validates discover query", () => {
    const r1 = validateDiscoverQuery(new URLSearchParams(""));
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.data.minPrice).toBe(0);
      expect(r1.data.maxPrice).toBe(99999);
      expect(r1.data.limit).toBe(20);
    }

    const r2 = validateDiscoverQuery(new URLSearchParams("minPrice=abc"));
    expect(r2.ok).toBe(false);

    const r3 = validateDiscoverQuery(new URLSearchParams("minPrice=500&maxPrice=100"));
    expect(r3.ok).toBe(false);

    const r4 = validateDiscoverQuery(new URLSearchParams("limit=500"));
    expect(r4.ok).toBe(true);
    if (r4.ok) expect(r4.data.limit).toBe(50);

    const r5 = validateDiscoverQuery(new URLSearchParams("limit=0"));
    expect(r5.ok).toBe(false);

    const r6 = validateDiscoverQuery(new URLSearchParams("search=" + encodeURIComponent("  spanish  ")));
    expect(r6.ok).toBe(true);
    if (r6.ok) expect(r6.data.search).toBe("spanish");

    const r7 = validateDiscoverQuery(new URLSearchParams("cursor=" + encodeURIComponent("'; DROP TABLE teachers; --")));
    expect(r7.ok).toBe(false);

    const r8 = validateDiscoverQuery(new URLSearchParams("cursor=8b1f7e2a-aaaa-bbbb-cccc-000000000000"));
    expect(r8.ok).toBe(true);
  });

  it("validates classes filter", () => {
    const r1 = validateClassesFilter(null);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.data).toBe("upcoming");

    const r2 = validateClassesFilter("past");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.data).toBe("past");

    const r3 = validateClassesFilter("literally-anything");
    expect(r3.ok).toBe(false);
  });

  it("validates profile update", () => {
    const r1 = validateProfileUpdate({ name: "  Jordan  ", proficiencyLevel: "b2" });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.data.name).toBe("Jordan");
      expect(r1.data.proficiencyLevel).toBe("B2");
    }

    const r2 = validateProfileUpdate({ proficiencyLevel: "expert" });
    expect(r2.ok).toBe(false);

    const r3 = validateProfileUpdate({});
    expect(r3.ok).toBe(false);

    const r4 = validateProfileUpdate({ avatarUrl: null });
    expect(r4.ok).toBe(true);
  });

  it("validates complaint", () => {
    const r1 = validateComplaint({ category: "PAYMENT_ISSUE", subject: "Refund", description: "My class was cancelled and I was not refunded." });
    expect(r1.ok).toBe(true);

    const r2 = validateComplaint({ category: "NOT_A_CATEGORY", subject: "x", description: "y" });
    expect(r2.ok).toBe(false);

    const r3 = validateComplaint({ category: "OTHER", subject: "ab", description: "too short too" });
    expect(r3.ok).toBe(false);
  });

  it("validates device token", () => {
    const r1 = validateDeviceToken({ token: "a".repeat(64), platform: "iOS" });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.data.platform).toBe("ios");

    const r2 = validateDeviceToken({ token: "short", platform: "ios" });
    expect(r2.ok).toBe(false);

    const r3 = validateDeviceToken({ token: "a".repeat(64), platform: "windows-phone" });
    expect(r3.ok).toBe(false);
  });

  it("validates notification update", () => {
    const r1 = validateNotificationUpdate({});
    expect(r1.ok).toBe(true);

    const r2 = validateNotificationUpdate({ notificationId: "abc-123" });
    expect(r1.ok).toBe(true);

    const r3 = validateNotificationUpdate({ notificationId: 12345 });
    expect(r3.ok).toBe(false);
  });

  it("validates change password", () => {
    const r1 = validateChangePassword({ currentPassword: "oldPass1", newPassword: "newPass123" });
    expect(r1.ok).toBe(true);

    const r2 = validateChangePassword({ currentPassword: "oldPass1", newPassword: "short" });
    expect(r2.ok).toBe(false);

    const r3 = validateChangePassword({ currentPassword: "oldPass1", newPassword: 12345678 as unknown as string });
    expect(r3.ok).toBe(false);

    const r4 = validateChangePassword({ currentPassword: "", newPassword: "newPass123" });
    expect(r4.ok).toBe(false);

    const r5 = validateChangePassword({ currentPassword: "samePass1", newPassword: "samePass1" });
    expect(r5.ok).toBe(false);

    const r6 = validateChangePassword({});
    expect(r6.ok).toBe(false);
  });

  it("validates book class", () => {
    const r1 = validateBookClass({ rateId: "rate-abc123" });
    expect(r1.ok).toBe(true);

    const r2 = validateBookClass({ rateId: "" });
    expect(r2.ok).toBe(false);

    const r3 = validateBookClass({ rateId: 12345 as unknown as string });
    expect(r3.ok).toBe(false);

    const r4 = validateBookClass({});
    expect(r4.ok).toBe(false);

    const r5 = validateBookClass({ demo: true });
    expect(r5).toEqual({ ok: true, data: { demo: true } });

    // Only a literal `true` selects the demo; anything else still needs a rate.
    const r6 = validateBookClass({ demo: "true" });
    expect(r6.ok).toBe(false);
  });

  it("validates chat message", () => {
    const r1 = validateChatMessage({ content: "Hi, can we reschedule Tuesday's class?" });
    expect(r1.ok).toBe(true);

    const r2 = validateChatMessage({ content: "  trim me  " });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.data.content).toBe("trim me");

    const r3 = validateChatMessage({ content: "x".repeat(5001) });
    expect(r3.ok).toBe(false);

    const r4 = validateChatMessage({ content: { not: "a string" } as unknown as string });
    expect(r4.ok).toBe(false);

    const r5 = validateChatMessage({});
    expect(r5.ok).toBe(true);
    if (r5.ok) expect(r5.data.content).toBe("");
  });
});
