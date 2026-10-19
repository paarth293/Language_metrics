// 1. Login — POST /api/auth/login (student-web)
// Measures bcrypt + Redis session write under load. Expect 429s from one IP:
// the route allows 10/min per IP. To measure raw capacity, whitelist the
// generator on staging or run from many IPs (k6 cloud / distributed).
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, STUDENT_PASSWORD, pickEmail, standardStages } from "./lib/common.js";

export const options = {
  stages: standardStages,
  thresholds: {
    "http_req_duration{name:login}": ["p(95)<800", "p(99)<2000"],
    "checks{check:not_5xx}": ["rate>0.99"],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: pickEmail(), password: STUDENT_PASSWORD, role: "STUDENT" }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "login" } }
  );
  check(res, {
    not_5xx: (r) => r.status < 500,
    "200 or 429": (r) => r.status === 200 || r.status === 429,
  }, { check: "not_5xx" });
  sleep(1 + Math.random() * 2);
}
