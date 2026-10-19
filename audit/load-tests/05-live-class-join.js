// 5. Live-class join — POST /api/live/token (student-web) + waiting-room poll
// GET /api/live/:sessionId/status. Each token request makes 2 LiveKit API
// calls (listRooms + createRoom, packages/livekit/src/server.ts:179-188).
// The spike stage models every class starting at :00.
//
// Staging only, with a LiveKit project you are allowed to load (each issued
// token is free until a client actually connects; this script never connects).
// SESSION_IDS must be ClassSession ids whose join window is open for the test students.
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authParams, loginAll, standardStages, tokenFor } from "./lib/common.js";

const SESSION_IDS = (__ENV.SESSION_IDS || "").split(",").filter(Boolean);

export const options = {
  stages: standardStages,
  thresholds: {
    "http_req_duration{name:live_token}": ["p(95)<1500"],
    "http_req_duration{name:live_status}": ["p(95)<300"],
    "checks{check:no_5xx}": ["rate>0.99"],
  },
};

export function setup() {
  if (SESSION_IDS.length === 0) throw new Error("Set SESSION_IDS");
  return { tokens: loginAll() };
}

export default function (data) {
  const token = tokenFor(data.tokens);
  const sessionId = SESSION_IDS[(__VU - 1) % SESSION_IDS.length];

  // Waiting room polls status before joining.
  for (let i = 0; i < 3; i++) {
    const s = http.get(`${BASE_URL}/api/live/${sessionId}/status`, authParams(token, "live_status"));
    check(s, { no_5xx: (r) => r.status < 500 }, { check: "no_5xx" });
    sleep(2);
  }

  const res = http.post(`${BASE_URL}/api/live/token`, JSON.stringify({ classSessionId: sessionId }), authParams(token, "live_token"));
  // 200 token; 403/409/425 outside window or not a participant; 429 >20/min per user; 503 budget/LiveKit.
  check(res, { no_5xx: (r) => r.status < 500 || r.status === 503 }, { check: "no_5xx" });
  sleep(20 + Math.random() * 10);
}
