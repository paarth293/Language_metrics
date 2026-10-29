// 3. Create/write — POST /api/students/teacher/:id/book (student-web)
// Exercises the pg_advisory_xact_lock per teacher
// (packages/live-classes/src/booking.ts:188) and the coin hold.
// Many VUs target the SAME few teachers on purpose, to measure lock contention.
//
// Staging only: this creates real bookings and holds coins. Seed test students
// with coins and set TEACHER_IDS to approved test teachers.
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authParams, loginAll, standardStages, tokenFor } from "./lib/common.js";

const TEACHER_IDS = (__ENV.TEACHER_IDS || "").split(",").filter(Boolean);
const RATE_ID = __ENV.RATE_ID || ""; // optional TeacherRate id for an HOURLY booking

export const options = {
  stages: standardStages,
  thresholds: {
    "http_req_duration{name:book}": ["p(95)<1500"],
    "checks{check:no_5xx}": ["rate>0.99"],
  },
};

export function setup() {
  if (TEACHER_IDS.length === 0) throw new Error("Set TEACHER_IDS");
  return { tokens: loginAll() };
}

export default function (data) {
  const token = tokenFor(data.tokens);
  const teacherId = TEACHER_IDS[Math.floor(Math.random() * TEACHER_IDS.length)];
  // Random 30-min slot 2-30 days out, on the half hour.
  const start = new Date(Date.now() + (2 + Math.floor(Math.random() * 28)) * 86400_000);
  start.setUTCMinutes(Math.random() < 0.5 ? 0 : 30, 0, 0);
  start.setUTCHours(3 + Math.floor(Math.random() * 12));

  const body = RATE_ID
    ? { rateId: RATE_ID, durationMinutes: 30, slotStart: start.toISOString() }
    : { demo: true, durationMinutes: 30, slotStart: start.toISOString() };

  const res = http.post(`${BASE_URL}/api/students/teacher/${teacherId}/book`, JSON.stringify(body), authParams(token, "book"));
  // 201 booked; 400/409 slot taken / not enough coins / demo used — all expected business outcomes.
  check(res, { no_5xx: (r) => r.status < 500 }, { check: "no_5xx" });
  sleep(2 + Math.random() * 3);
}
