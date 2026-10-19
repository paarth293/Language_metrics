// 2. Main list/read — GET /api/students/discover (student-web), plus the
// chat thread list, which every open chat tab polls every 3 s
// (apps/student-web/src/app/(authenticated)/chat/page.tsx:92).
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, authParams, loginAll, standardStages, tokenFor } from "./lib/common.js";

export const options = {
  stages: standardStages,
  thresholds: {
    "http_req_duration{name:discover}": ["p(95)<500"],
    "http_req_duration{name:chat_threads}": ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  return { tokens: loginAll() };
}

const LANGS = ["", "spanish", "french", "german", "japanese", "english"];

export default function (data) {
  const token = tokenFor(data.tokens);
  const lang = LANGS[Math.floor(Math.random() * LANGS.length)];
  const q = lang ? `?language=${lang}&limit=20` : "?limit=20";

  const res = http.get(`${BASE_URL}/api/students/discover${q}`, authParams(token, "discover"));
  check(res, { "discover 200": (r) => r.status === 200 });

  // Follow the cursor once, like a user scrolling.
  if (res.status === 200) {
    const next = res.json("pagination.nextCursor");
    if (next) {
      const sep = q ? "&" : "?";
      http.get(`${BASE_URL}/api/students/discover${q}${sep}cursor=${next}`, authParams(token, "discover"));
    }
  }

  // Simulate a chat tab polling for 15 s.
  for (let i = 0; i < 5; i++) {
    const t = http.get(`${BASE_URL}/api/students/chat`, authParams(token, "chat_threads"));
    check(t, { "chat 200": (r) => r.status === 200 });
    sleep(3);
  }
}
