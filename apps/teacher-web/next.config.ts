import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
              `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://lh3.googleusercontent.com https://i.pravatar.cc https://avatars.githubusercontent.com https://flagcdn.com",
              "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
              "frame-src https://accounts.google.com",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      // Static assets — aggressive caching
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
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
