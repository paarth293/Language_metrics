// 4. Payment create-order — POST /api/payments/create-order (student-web)
// Each successful call creates a REAL order at Cashfree, so:
//   - run ONLY against staging with CASHFREE_ENV=sandbox,
//   - keep TARGET_VUS low (Cashfree sandbox has its own rate limits),
//   - expect many abandoned CREATED orders afterwards (the reconciler sweeps 50 per run).
// Body shape comes from resolveCoinPackage (@repo/api-contracts). Set PACK_BODY to
// a valid pack JSON for your build, e.g. '{"coins":500}'.
import http from "k6/http";
import { check, sleep, fail } from "k6";
import { BASE_URL, authParams, loginAll, tokenFor } from "./lib/common.js";

if (__ENV.CASHFREE_SANDBOX_CONFIRMED !== "yes") {
  fail("Set CASHFREE_SANDBOX_CONFIRMED=yes after checking the target uses CASHFREE_ENV=sandbox.");
}

const T = Number(__ENV.TARGET_VUS || 20);
export const options = {
  stages: [
    { duration: "1m", target: Math.round(T * 0.5) },
    { duration: "5m", target: T },
    { duration: "20s", target: T * 3 },
    { duration: "1m", target: T * 3 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    "http_req_duration{name:create_order}": ["p(95)<2000"],
    "checks{check:no_5xx}": ["rate>0.99"],
  },
};

export function setup() {
  return { tokens: loginAll() };
}

export default function (data) {
  const token = tokenFor(data.tokens);
  const body = __ENV.PACK_BODY || '{"coins":500}';
  const res = http.post(`${BASE_URL}/api/payments/create-order`, body, authParams(token, "create_order"));
  check(res, {
    no_5xx: (r) => r.status < 500,
    "has paymentSessionId": (r) => r.status !== 200 || !!r.json("paymentSessionId"),
  }, { check: "no_5xx" });
  sleep(5 + Math.random() * 5);
}
