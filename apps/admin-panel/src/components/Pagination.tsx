"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ totalPages, currentPage }: { totalPages: number; currentPage: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const disabledClass = "flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--lm-line)] text-[var(--lm-subtle)] opacity-45";
  const linkClass = "flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--lm-line)] text-[var(--lm-muted)] transition-colors hover:border-[var(--lm-line-strong)] hover:bg-[var(--lm-hover)] hover:text-[var(--lm-ink-strong)]";

  return (
    <nav className="flex items-center justify-between gap-4 border-t border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-5 py-3.5" aria-label="Pagination">
      <p className="text-[11px] text-[var(--lm-muted)]">Page <span className="lm-mono font-semibold text-[var(--lm-ink)]">{currentPage}</span> of <span className="lm-mono font-semibold text-[var(--lm-ink)]">{totalPages}</span></p>
      <div className="flex gap-2">
        {currentPage > 1 ? <Link href={createPageUrl(currentPage - 1)} className={linkClass} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></Link> : <span className={disabledClass} aria-hidden="true"><ChevronLeft size={16} /></span>}
        {currentPage < totalPages ? <Link href={createPageUrl(currentPage + 1)} className={linkClass} aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></Link> : <span className={disabledClass} aria-hidden="true"><ChevronRight size={16} /></span>}
      </div>
    </nav>
  );
}
