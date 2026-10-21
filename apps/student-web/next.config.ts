import type { NextConfig } from "next";
import { CSP_HEADER, contentSecurityPolicy } from "./src/csp";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Dev-only badge; bottom-left sat on top of the sidebar's sign-out row.
  devIndicators: { position: "bottom-right" },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  /**
   * Client Router Cache.
   *
   * Next's default for a dynamically rendered route is `dynamic: 0`: the RSC
   * payload is thrown away the moment it is used, so every client-side
   * navigation — including Back and Forward — re-requests the route from the
   * server and shows its loading boundary again. That is what made revisiting
   * a page, or stepping back to one, look like a reload.
   *
   * Thirty seconds makes a revisit within half a minute instant and
   * boundary-free. The pages under it are client components whose data comes
   * from API routes, and those re-authenticate on every call, so a reused
   * payload cannot expose anything a fresh one would not. A mutation that
   * needs the tree re-rendered still calls router.refresh(), which clears
   * this cache.
   */
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: CSP_HEADER, value: contentSecurityPolicy(process.env) },
        ],
      },
    ];
  },
};

export default nextConfig;
