import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Google OAuth profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "googleusercontent.com" },
      // Flags
      { protocol: "https", hostname: "flagcdn.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },

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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
          // Allows: self-hosted assets, Google OAuth, Upstash Redis (API calls go server-side)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: only self + Next.js dev overlay in dev
              `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
              // Styles: self + inline (required by Next.js)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts: self + Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + Google profile photos + data URIs + flags
              "img-src 'self' data: https://lh3.googleusercontent.com https://i.pravatar.cc https://avatars.githubusercontent.com https://flagcdn.com",
              // API connections: self + Google OAuth endpoints
              "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
              // Frames: only Google OAuth popup
              "frame-src https://accounts.google.com",
              // Form actions: only self
              "form-action 'self'",
              // Base URI: only self (prevents base tag injection)
              "base-uri 'self'",
              // Object sources: none
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;

