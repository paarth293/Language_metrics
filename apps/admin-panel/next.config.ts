import type { NextConfig } from "next";

const securityHeaders = [
  // Strict HSTS — force TLS for one year, include subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Block MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Deny framing the panel in any other origin (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Only send the origin on navigation, never full referrers.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable features the panel does not need.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // CSP: self-only sources; inline styles/scripts needed by Next hydration;
  // external images (dicebear avatars) explicitly allowed.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "img-src 'self' data: https://api.dicebear.com",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""}`,
      "connect-src 'self'",
      "font-src 'self' data:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  poweredByHeader: false, // hide framework identity
};

export default nextConfig;
