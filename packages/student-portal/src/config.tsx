"use client";

import React, { createContext, useContext, useMemo } from "react";
import { MotionConfig } from "framer-motion";

/**
 * The student portal is served by two apps: student-web at `/dashboard` and
 * teacher-web at `/student/dashboard`. Screens never hard-code either; they
 * build links with `href()` and send writes through the app's own `fetch`
 * (teacher-web refreshes an expired access token on a 401, student-web does
 * not need to).
 */
export interface PortalConfig {
  /** Prefix for every portal route: "" on student-web, "/student" on teacher-web. */
  basePath: string;
  /** Used for writes. Reads go through the shared resource cache. */
  fetch: typeof fetch;
  /** Routes that exist in one app but not the other. */
  features: PortalFeatures;
}

export interface PortalFeatures {
  /** POST /api/students/classes/:sessionId/reschedule — student-web only. */
  reschedule: boolean;
}

const PortalContext = createContext<PortalConfig | null>(null);

export function PortalProvider({
  basePath,
  fetchImpl,
  reschedule = false,
  children,
}: {
  basePath: string;
  fetchImpl?: typeof fetch;
  reschedule?: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo<PortalConfig>(
    () => ({
      basePath,
      fetch: fetchImpl ?? ((input, init) => fetch(input, { credentials: "include", ...init })),
      features: { reschedule },
    }),
    [basePath, fetchImpl, reschedule]
  );
  // "user" follows the visitor's reduced-motion setting for every animation
  // in the portal, so no component has to check it on its own.
  return (
    <PortalContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const config = useContext(PortalContext);
  if (!config) throw new Error("usePortal must be used inside <PortalProvider>");
  return {
    ...config,
    /** "/discover" -> "/student/discover" on teacher-web. */
    href: (path: string) => `${config.basePath}${path}`,
  };
}
