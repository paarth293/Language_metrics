"use client";

import React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div 
      style={{ backgroundColor: "var(--lm-bg)" }} 
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="max-w-md w-full flex flex-col items-center space-y-6">
        {/* Icon */}
        <div 
          style={{ backgroundColor: "var(--lm-surface2)", color: "var(--lm-accent)" }} 
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm"
        >
          <Compass className="w-8 h-8" />
        </div>

        {/* Content */}
        <div>
          <h1 
            style={{ color: "var(--lm-text)" }} 
            className="text-3xl font-bold tracking-tight mb-2"
          >
            Page Not Found
          </h1>
          <p 
            style={{ color: "var(--lm-text-muted)" }} 
            className="text-sm"
          >
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        {/* Action Button */}
        <Link 
          href="/" 
          style={{ backgroundColor: "var(--lm-accent)", color: "var(--lm-bg)" }}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
