"use client";

import React, { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "lm-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white border border-border rounded-2xl shadow-lg p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Cookie className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text mb-1">We use cookies</p>
            <p className="text-xs text-text-muted leading-relaxed">
              We use essential cookies to make our site work. We&apos;d also like to set analytics cookies to help us improve.{" "}
              <a href="/privacy" className="text-brand hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-xl text-sm font-medium text-text-muted hover:bg-surface-inset transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-5 py-2 rounded-xl bg-navy text-white text-sm font-medium hover:bg-navy-2 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
