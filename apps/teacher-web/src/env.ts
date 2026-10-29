/**
 * src/env.ts — environment check run once at boot (instrumentation.ts).
 *
 * Without it a missing CRON_SECRET, CASHFREE_* or REDIS_URL only shows up on
 * the first request that needs it (#31). In production a bad environment
 * stops the boot with one message naming every problem; in development it
 * only warns. Messages carry variable names, never values.
 */
import { z } from "zod";

type Env = Record<string, string | undefined>;

const APP = "teacher-web";

/** Needed by every production deployment of this app. */
// No CRON_SECRET: the cron routes run on student-web only (#20).
const REQUIRED = ["DATABASE_URL", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "REDIS_URL"];

/**
 * Optional features: off when none of their variables is set, broken when only
 * some are. Each entry lists a variable and its accepted aliases.
 */
const FEATURES: { name: string; vars: string[][] }[] = [
  { name: "Cashfree", vars: [["CASHFREE_ENV"], ["CASHFREE_CLIENT_ID"], ["CASHFREE_CLIENT_SECRET"]] },
  { name: "LiveKit", vars: [["LIVEKIT_API_KEY"], ["LIVEKIT_API_SECRET"], ["LIVEKIT_WS_URL", "LIVEKIT_URL"]] },
  { name: "Zoho email", vars: [["ZOHO_SMTP_HOST"], ["ZOHO_EMAIL"], ["ZOHO_APP_PASSWORD"]] },
  { name: "Google sign-in", vars: [["GOOGLE_CLIENT_ID"], ["GOOGLE_CLIENT_SECRET"]] },
];

/** Credentials each STORAGE_PROVIDER needs (see lib/storage.ts). */
const STORAGE = new Map<string, string[]>([
  ["s3", ["STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"]],
  ["supabase", ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]],
  ["local", []],
]);

/** Shape of the values that are set. Messages never include the value. */
const FORMATS = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL").optional(),
  DIRECT_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL").optional(),
  REDIS_URL: z.string().regex(/^rediss?:\/\//, "must be a redis:// or rediss:// URL").optional(),
  CASHFREE_ENV: z.enum(["production", "sandbox"], { error: 'must be "production" or "sandbox"' }).optional(),
  LIVEKIT_WS_URL: z.string().regex(/^(wss?|https?):\/\//, "must be a ws(s):// or http(s):// URL").optional(),
  LIVEKIT_URL: z.string().regex(/^(wss?|https?):\/\//, "must be a ws(s):// or http(s):// URL").optional(),
  STORAGE_PROVIDER: z.enum(["s3", "supabase", "local"], { error: 'must be "s3", "supabase" or "local"' }).optional(),
  PAYMENT_ALERT_WEBHOOK_URL: z.url({ error: "must be a URL" }).optional(),
  OPS_ALERT_WEBHOOK_URL: z.url({ error: "must be a URL" }).optional(),
  SENTRY_DSN: z.url({ error: "must be a URL" }).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url({ error: "must be a URL" }).optional(),
  ZOHO_SMTP_PORT: z.string().regex(/^\d+$/, "must be a port number").optional(),
  NEXT_PUBLIC_APP_URL: z.url({ error: "must be a URL" }).optional(),
});

const isSet = (vars: Map<string, string | undefined>, name: string) => (vars.get(name) ?? "").trim() !== "";

/** Every problem with `env`, as "NAME …" sentences; empty when it is usable. */
export function checkEnv(env: Env): string[] {
  const vars = new Map(Object.entries(env));
  const problems = REQUIRED.filter((name) => !isSet(vars, name)).map((name) => `${name} is required`);

  const setOnly = Object.fromEntries([...vars].filter(([name]) => isSet(vars, name)));
  const parsed = FORMATS.safeParse(setOnly);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) problems.push(`${String(issue.path[0])} ${issue.message}`);
  }

  for (const feature of FEATURES) {
    const missing = feature.vars.filter((names) => !names.some((name) => isSet(vars, name)));
    if (missing.length > 0 && missing.length < feature.vars.length) {
      const names = missing.map(([name, ...aliases]) => (aliases.length ? `${name} (or ${aliases.join(", ")})` : name));
      problems.push(`${feature.name} is partly configured: ${names.join(", ")} ${missing.length > 1 ? "are" : "is"} missing`);
    }
  }

  const provider = (vars.get("STORAGE_PROVIDER") ?? "local").trim() || "local";
  for (const name of STORAGE.get(provider) ?? []) {
    if (!isSet(vars, name)) problems.push(`STORAGE_PROVIDER=${provider} needs ${name}`);
  }

  return problems;
}

/** Throw in production, warn in development. Called from instrumentation.ts. */
export function validateEnvOnBoot(env: Env = process.env): void {
  const problems = checkEnv(env);
  if (problems.length === 0) return;
  const message = `Invalid environment for ${APP} (${problems.length} problem${problems.length > 1 ? "s" : ""}):\n- ${problems.join("\n- ")}`;
  if (env.NODE_ENV === "production") throw new Error(message);
  console.warn(`[env] ${message}`);
}
