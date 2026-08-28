"use client";

import React, { useEffect } from "react";

/**
 * Analytics component — placeholder for production analytics integration.
 *
 * Respects cookie consent: only loads analytics scripts if the user has
 * accepted cookies. Replace MEASUREMENT_ID with your actual Google Analytics
 * or Plausible/Mixpanel/etc. ID when ready.
 *
 * Usage: Add <Analytics /> to the root layout.
 */
export function Analytics() {
  useEffect(() => {
    const consent = localStorage.getItem("lm-cookie-consent");
    if (consent !== "accepted") return;

    // TODO: Replace with your actual analytics provider
    // Example: Google Analytics 4
    //
    // const script = document.createElement("script");
    // script.async = true;
    // script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    // document.head.appendChild(script);
    //
    // window.dataLayer = window.dataLayer || [];
    // function gtag() { window.dataLayer.push(arguments); }
    // gtag("js", new Date());
    // gtag("config", MEASUREMENT_ID, { page_path: window.location.pathname });

    console.log("[Analytics] User accepted cookies — analytics would load here.");
  }, []);

  return null;
}
