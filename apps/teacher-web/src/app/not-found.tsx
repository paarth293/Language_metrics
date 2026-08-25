"use client";

import React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full flex flex-col items-center space-y-6 animate-fade-up">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-brand-subtle text-brand flex items-center justify-center shadow-sm">
          <Compass className="w-8 h-8" />
        </div>

        {/* Content */}
        <div>
          <h1 className="font-display text-4xl font-bold text-brand mb-2">Page Not Found</h1>
          <p className="text-text-muted text-sm">
            Sorry, we couldn&apos;t find the page you are looking for. It might have been moved or deleted.
          </p>
        </div>

        {/* Action Button */}
        <Button asChild variant="gold" className="w-full sm:w-auto px-8">
          <Link href="/">
            Go Back Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
