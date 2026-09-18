/**
 * Verifies generateLiveKitToken() actually behaves the way
 * classes/[id]/livekit-token/route.ts now depends on: when LiveKit isn't
 * configured (no LIVEKIT_API_KEY/SECRET/WS_URL — true of a fresh dev
 * checkout before those env vars are set), it must still return a usable
 * token/wsUrl pair instead of throwing or returning something route code
 * can't destructure. That route used to build its own fake
 * `dev-token-${userId}-${sessionId}` string instead of calling this
 * function at all — this test exists to make sure the function it now
 * calls actually works.
 *
 * Run with: tsx src/lib/livekit.test.ts
 * (No install needed — no external imports.)
 */
import { generateLiveKitToken, isLiveKitConfigured } from "./livekit";

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

async function main() {
  check(
    isLiveKitConfigured() === false,
    "not configured in this environment (no API key/secret/ws url set) — exercising the fallback path the route relies on until real LiveKit credentials are set"
  );

  const result = await generateLiveKitToken({
    roomName: "class-abc123",
    identity: "user-1",
    name: "Student",
    role: "student",
  });

  check(typeof result.token === "string" && result.token.length > 0, "returns a non-empty token string", result);
  check(
    result.token.includes("user-1") && result.token.includes("class-abc123"),
    "mock token is traceable to identity+room for local debugging",
    result
  );
  check(typeof result.wsUrl === "string" && result.wsUrl.startsWith("ws"), "returns a usable wsUrl", result);
  check(
    result.token !== undefined && result.wsUrl !== undefined,
    "neither field is undefined (what the route sends straight to the client)"
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
