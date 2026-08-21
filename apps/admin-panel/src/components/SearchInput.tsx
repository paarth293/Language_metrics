"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";

export function SearchInput({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    } else {
      params.delete("q");
    }
    params.delete("page");

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [debouncedQuery, pathname, router, searchParams]);

  return (
    <div className="relative flex w-full max-w-[260px] items-center">
      <Search size={16} className="pointer-events-none absolute left-3.5 text-[var(--lm-subtle)]" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="lm-input h-10 w-full pl-10 pr-9 text-[12px]"
      />
      {query ? (
        <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-md text-[var(--lm-subtle)] hover:bg-[var(--lm-hover)] hover:text-[var(--lm-ink)]">
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
