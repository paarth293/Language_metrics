import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Origins the live classroom must reach from the browser. The LiveKit client
 * opens a WebSocket to the project URL and, on LiveKit Cloud, also fetches
 * region settings and may fail over to a regional host — all under
 * *.livekit.cloud. A self-hosted server is allowed by its configured host.
 * Without these, CSP silently blocks the connection and the classroom shows
 * "could not establish signal connection: Failed to fetch".
 */
const liveKitConnectSrc = (() => {
  const origins = ["wss://*.livekit.cloud", "https://*.livekit.cloud"];
  const raw = (process.env.LIVEKIT_WS_URL ?? process.env.LIVEKIT_URL ?? "").trim();
  if (raw) {
    try {
      const host = new URL(raw.includes("://") ? raw : `wss://${raw}`).host;
      if (!host.endsWith(".livekit.cloud")) origins.push(`wss://${host}`, `https://${host}`);
    } catch {
      // Malformed URL: the LiveKit config reports it; don't break every page's headers.
    }
  }
  return origins.join(" ");
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Dev-only badge; bottom-left sat on top of the sidebar's Log out button.
  devIndicators: { position: "bottom-right" },

  // ── Image Optimization ──────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "googleusercontent.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // Serve smaller images on mobile
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // ── Compression ─────────────────────────────────────────────────────
  // Enable gzip/brotli compression (handled by hosting platform, but
  // this ensures Next.js outputs are compressible)
  compress: true,

  // ── Production Optimizations ────────────────────────────────────────
  // Generate source maps in production for error tracking
  productionBrowserSourceMaps: false,

  // ── Bundle Analyzer (optional, enable when needed) ──────────────────
  // Uncomment to analyze bundle:
  // experimental: { instrumentationHook: true },

  // ── Output optimization ─────────────────────────────────────────────
  // Prefetches hover/touch resources for faster navigation
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // Enable PPR for progressive rendering
    // ppr: true, // Enable when stable
  },

  // ── Rewrites for SEO-friendly URLs ──────────────────────────────────
  async rewrites() {
    return [
      // Teacher app login redirects
      {
        source: "/teacher/login",
        destination: "/login/teacher",
      },
      {
        source: "/student/login",
        destination: "/login/student",
      },
    ];
  },

  // ── Security & Performance Headers ──────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing protection
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions policy
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          // HSTS — force HTTPS for 1 year, include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + Next.js dev overlay in dev only
              // unsafe-eval is ONLY needed for Next.js HMR in development
              `script-src 'self'${isProd ? "" : " 'unsafe-eval'"} 'unsafe-inline'`,
              // Styles: self + inline (required by Next.js)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://lh3.googleusercontent.com https://i.pravatar.cc https://avatars.githubusercontent.com https://flagcdn.com",
              `connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com ${liveKitConnectSrc}`,
              "frame-src https://accounts.google.com",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      // Static assets — aggressive caching, production only. Production
      // chunk names are content-hashed, so "immutable" is safe there. Dev
      // (Turbopack) reuses the same chunk names across edits; caching them
      // for a year made the browser run stale code against fresh server
      // HTML and throw hydration mismatches after every change.
      ...(isProd
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : [
            // Browsers that loaded the app while dev chunks were still sent
            // as "immutable" never revalidate them, so they keep running old
            // code (hydration mismatches, "module factory is not available").
            // Tell the browser to drop its HTTP cache on every dev page load
            // so those poisoned entries can't survive. Dev only.
            {
              source: "/((?!_next|api).*)",
              headers: [{ key: "Clear-Site-Data", value: '"cache"' }],
            },
          ]),
      // Brand images — cache for 7 days
      {
        source: "/brand/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
