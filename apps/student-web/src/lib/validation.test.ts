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

let pass = 0;
let fail = 0;

function check(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    if (detail !== undefined) console.log("      " + JSON.stringify(detail));
  }
}

// ── login ──────────────────────────────────────────────────────────────
{
  const r = validateLoginBody({ email: "  Student@Example.com ", password: "hunter2" });
  check(r.ok === true, "login: valid body accepted");
  if (r.ok) {
    check(r.data.email === "student@example.com", "login: email normalized to lowercase+trim", r.data);
  }
}
{
  const r = validateLoginBody({ email: "not-an-email", password: "x" });
  check(r.ok === false, "login: malformed email rejected");
}
{
  const r = validateLoginBody({ email: "a@b.com" });
  check(r.ok === false, "login: missing password rejected");
}
{
  const r = validateLoginBody({ email: "a@b.com", password: "x", role: "ADMIN" });
  check(r.ok === false, "login: invalid role rejected");
}
{
  const r = validateLoginBody("not an object");
  check(r.ok === false, "login: non-object body rejected");
}

// ── discover query ─────────────────────────────────────────────────────
{
  const r = validateDiscoverQuery(new URLSearchParams(""));
  check(r.ok === true, "discover: empty query uses defaults");
  if (r.ok) {
    check(r.data.minPrice === 0 && r.data.maxPrice === 99999 && r.data.limit === 20, "discover: default values correct", r.data);
  }
}
{
  // This is the exact bug class the old code had: parseInt("abc") -> NaN,
  // and `x >= NaN` is always false, so every teacher was silently filtered
  // out with no error. The new validator must reject this instead.
  const r = validateDiscoverQuery(new URLSearchParams("minPrice=abc"));
  check(r.ok === false, "discover: non-numeric minPrice rejected instead of silently becoming NaN");
}
{
  const r = validateDiscoverQuery(new URLSearchParams("minPrice=500&maxPrice=100"));
  check(r.ok === false, "discover: maxPrice < minPrice rejected");
}
{
  const r = validateDiscoverQuery(new URLSearchParams("limit=500"));
  check(r.ok === true, "discover: oversized limit is clamped, not rejected (preserves old behavior)");
  if (r.ok) check(r.data.limit === 50, "discover: oversized limit clamped to 50", r.data);
}
{
  const r = validateDiscoverQuery(new URLSearchParams("limit=0"));
  check(r.ok === false, "discover: limit=0 rejected");
}
{
  const r = validateDiscoverQuery(new URLSearchParams("search=" + encodeURIComponent("  spanish  ")));
  check(r.ok === true && r.ok && r.data.search === "spanish", "discover: search is trimmed");
}
{
  const r = validateDiscoverQuery(new URLSearchParams("cursor=" + encodeURIComponent("'; DROP TABLE teachers; --")));
  check(r.ok === false, "discover: cursor with non-id characters rejected");
}
{
  const r = validateDiscoverQuery(new URLSearchParams("cursor=8b1f7e2a-aaaa-bbbb-cccc-000000000000"));
  check(r.ok === true, "discover: uuid-shaped cursor accepted");
}

// ── classes filter ─────────────────────────────────────────────────────
{
  const r = validateClassesFilter(null);
  check(r.ok === true && r.ok && r.data === "upcoming", "classes filter: missing defaults to upcoming");
}
{
  const r = validateClassesFilter("past");
  check(r.ok === true && r.ok && r.data === "past", "classes filter: valid value accepted");
}
{
  // Old behavior: an unrecognized filter silently fell through the if/else
  // chain and returned EVERY booking regardless of status. New behavior:
  // reject it with a clear 400 instead of quietly over-sharing data.
  const r = validateClassesFilter("literally-anything");
  check(r.ok === false, "classes filter: unrecognized value rejected instead of silently returning all bookings");
}

// ── profile update ─────────────────────────────────────────────────────
{
  const r = validateProfileUpdate({ name: "  Jordan  ", proficiencyLevel: "b2" });
  check(r.ok === true, "profile: valid partial update accepted");
  if (r.ok) {
    check(r.data.name === "Jordan" && r.data.proficiencyLevel === "B2", "profile: name trimmed, proficiencyLevel uppercased", r.data);
  }
}
{
  const r = validateProfileUpdate({ proficiencyLevel: "expert" });
  check(r.ok === false, "profile: invalid CEFR level rejected");
}
{
  const r = validateProfileUpdate({});
  check(r.ok === false, "profile: empty update body rejected");
}
{
  const r = validateProfileUpdate({ avatarUrl: null });
  check(r.ok === true, "profile: avatarUrl null accepted (clearing avatar)");
}

// ── complaint ──────────────────────────────────────────────────────────
{
  const r = validateComplaint({ category: "PAYMENT_ISSUE", subject: "Refund", description: "My class was cancelled and I was not refunded." });
  check(r.ok === true, "complaint: valid ticket accepted");
}
{
  const r = validateComplaint({ category: "NOT_A_CATEGORY", subject: "x", description: "y" });
  check(r.ok === false, "complaint: unknown category rejected");
}
{
  const r = validateComplaint({ category: "OTHER", subject: "ab", description: "too short too" });
  check(r.ok === false, "complaint: too-short subject rejected");
}

// ── device token ───────────────────────────────────────────────────────
{
  const r = validateDeviceToken({ token: "a".repeat(64), platform: "iOS" });
  check(r.ok === true, "device token: valid token accepted, platform lowercased");
  if (r.ok) check(r.data.platform === "ios", "device token: platform normalized", r.data);
}
{
  const r = validateDeviceToken({ token: "short", platform: "ios" });
  check(r.ok === false, "device token: too-short token rejected");
}
{
  const r = validateDeviceToken({ token: "a".repeat(64), platform: "windows-phone" });
  check(r.ok === false, "device token: unsupported platform rejected");
}

// ── notification update ────────────────────────────────────────────────
{
  const r = validateNotificationUpdate({});
  check(r.ok === true, "notification update: empty body (mark-all-read) accepted");
}
{
  const r = validateNotificationUpdate({ notificationId: "abc-123" });
  check(r.ok === true, "notification update: valid id accepted");
}
{
  const r = validateNotificationUpdate({ notificationId: 12345 });
  check(r.ok === false, "notification update: non-string id rejected");
}

// ── change password ────────────────────────────────────────────────────
{
  const r = validateChangePassword({ currentPassword: "oldPass1", newPassword: "newPass123" });
  check(r.ok === true, "change password: valid body accepted");
}
{
  const r = validateChangePassword({ currentPassword: "oldPass1", newPassword: "short" });
  check(r.ok === false, "change password: too-short new password rejected");
}
{
  const r = validateChangePassword({ currentPassword: "oldPass1", newPassword: 12345678 as unknown as string });
  check(r.ok === false, "change password: non-string new password rejected (was an unguarded .length crash)");
}
{
  const r = validateChangePassword({ currentPassword: "", newPassword: "newPass123" });
  check(r.ok === false, "change password: empty current password rejected");
}
{
  const r = validateChangePassword({ currentPassword: "samePass1", newPassword: "samePass1" });
  check(r.ok === false, "change password: identical old/new password rejected");
}
{
  const r = validateChangePassword({});
  check(r.ok === false, "change password: missing fields rejected");
}

// ── book class ─────────────────────────────────────────────────────────
{
  const r = validateBookClass({ rateId: "rate-abc123" });
  check(r.ok === true, "book class: valid rateId accepted");
}
{
  const r = validateBookClass({ rateId: "" });
  check(r.ok === false, "book class: empty rateId rejected");
}
{
  const r = validateBookClass({ rateId: 12345 as unknown as string });
  check(r.ok === false, "book class: non-string rateId rejected (was previously only checked for truthiness)");
}
{
  const r = validateBookClass({});
  check(r.ok === false, "book class: missing rateId rejected");
}

// ── chat message ───────────────────────────────────────────────────────
{
  const r = validateChatMessage({ content: "Hi, can we reschedule Tuesday's class?" });
  check(r.ok === true, "chat message: valid content accepted");
}
{
  const r = validateChatMessage({ content: "  trim me  " });
  check(r.ok === true, "chat message: content trimmed");
  if (r.ok) check(r.data.content === "trim me", "chat message: trimmed value correct", r.data);
}
{
  const r = validateChatMessage({ content: "x".repeat(5001) });
  check(r.ok === false, "chat message: over-length content rejected");
}
{
  const r = validateChatMessage({ content: { not: "a string" } as unknown as string });
  check(r.ok === false, "chat message: non-string content rejected");
}
{
  const r = validateChatMessage({});
  check(r.ok === true, "chat message: missing content allowed (attachment-only message)");
  if (r.ok) check(r.data.content === "", "chat message: defaults to empty string", r.data);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
