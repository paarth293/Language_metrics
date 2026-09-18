"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: typeof window !== "undefined" ? window.location.origin : "",
      },
      ...items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: item.label,
        ...(item.href ? { item: `${typeof window !== "undefined" ? window.location.origin : ""}${item.href}` } : {}),
      })),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // HARDENING: this component isn't used anywhere in student-web yet
        // (verified — no other file references <Breadcrumbs>), so today
        // `items` is always static per-page copy, not attacker-controlled.
        // But JSON.stringify() does NOT escape "<", so the moment a caller
        // passes user-generated text as a label (e.g. a teacher's name in a
        // "Home > Discover > {teacherName}" trail), a label containing
        // "</script><script>…" would close this JSON-LD tag early and
        // inject a real, executable <script> right after it. Escaping "<"
        // as its unicode form neutralizes that while leaving the JSON
        // value and meaning completely unchanged.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
        <ol className="flex items-center gap-1.5 text-text-muted">
          <li>
            <Link href="/" className="hover:text-brand transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-text-subtle" />
              {item.href ? (
                <Link href={item.href} className="hover:text-brand transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-text font-medium">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
