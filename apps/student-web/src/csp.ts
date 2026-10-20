/**
 * Content-Security-Policy for student-web (#17), built like teacher-web's
 * (apps/teacher-web/next.config.ts) for the same Cashfree checkout and LiveKit
 * classroom.
 *
 * Sent as Report-Only for now: checkout and the classroom have not been
 * exercised in a browser under this policy. Once a preview deploy shows no
 * violations (browser console, or Sentry when a DSN is set), switch this to
 * "Content-Security-Policy" to enforce it.
 */
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

/** LiveKit Cloud, plus a self-hosted server's own host (same rule as teacher-web). */
function liveKitOrigins(env: NodeJS.ProcessEnv): string[] {
  const origins = ["wss://*.livekit.cloud", "https://*.livekit.cloud"];
  const raw = (env.LIVEKIT_WS_URL ?? env.LIVEKIT_URL ?? "").trim();
  if (raw) {
    try {
      const host = new URL(raw.includes("://") ? raw : `wss://${raw}`).host;
      if (host && !host.endsWith(".livekit.cloud")) origins.push(`wss://${host}`, `https://${host}`);
    } catch {
      // Malformed URL: the LiveKit config reports it; don't break every page's headers.
    }
  }
  return origins;
}

/** Browser Sentry's ingest origin and its CSP report endpoint, when a DSN is set. */
function sentryEndpoints(env: NodeJS.ProcessEnv): { origin: string; reportUri: string } | null {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !projectId) return null;
    return {
      origin: url.origin,
      reportUri: `${url.origin}/api/${projectId}/security/?sentry_key=${url.username}`,
    };
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(env: NodeJS.ProcessEnv): string {
  const isProd = env.NODE_ENV === "production";
  // Test-mode hosts only in sandbox, so production pages never trust them.
  const sandbox = env.CASHFREE_ENV === "sandbox";
  const cashfreeConnect = ["https://api.cashfree.com", ...(sandbox ? ["https://sandbox.cashfree.com"] : [])];
  const cashfreeFrames = [
    "https://sdk.cashfree.com", "https://api.cashfree.com", "https://payments.cashfree.com",
    ...(sandbox ? ["https://sandbox.cashfree.com", "https://payments-test.cashfree.com"] : []),
  ];
  const sentry = sentryEndpoints(env);

  return [
    "default-src 'self'",
    // 'unsafe-inline' for the theme script in layout.tsx; eval only for Next's dev overlay.
    `script-src 'self'${isProd ? "" : " 'unsafe-eval'"} 'unsafe-inline' https://sdk.cashfree.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // Students may paste any https avatar URL (profile page), and teacher
    // avatars and recording thumbnails come from storage hosts.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    ["connect-src 'self'", ...liveKitOrigins(env), ...cashfreeConnect, ...(sentry ? [sentry.origin] : [])].join(" "),
    `frame-src ${cashfreeFrames.join(" ")}`,
    // The modal checkout POSTs a hidden form into its iframe.
    `form-action 'self' ${cashfreeFrames.join(" ")}`,
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    ...(sentry ? [`report-uri ${sentry.reportUri}`] : []),
  ].join("; ");
}
