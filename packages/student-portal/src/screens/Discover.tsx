"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, ChevronDown, Clock, Search, SearchX, SlidersHorizontal, Star, X } from "lucide-react";
import { getCurrencyInfo } from "@repo/currency";
import { useJsonResource } from "@repo/ui/useResource";
import { useStickyState } from "@repo/ui/useStickyState";
import { useDebouncedValue } from "@repo/ui/useDebouncedValue";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { usePortal } from "../config";
import { coins } from "../format";
import { Avatar, EmptyState, ErrorState, PageHeader, Pill, Skeleton, ease } from "../primitives";

type DiscoverPage = {
  teachers: Teacher[];
  currency?: string;
  pagination?: { nextCursor: string | null; hasMore: boolean };
};

type Teacher = {
  id: string;
  name: string;
  avatar: string | null;
  languages: string[];
  rating: number;
  reviews: number;
  hourlyRate: number;
  currency: string;
  demoRate: number;
  headline: string | null;
  nextAvailable: string;
  experienceLevel: string;
  availability: boolean;
  gender?: string | null;
  totalHours?: number;
};

const LANGUAGES = ["English", "Spanish", "French", "Japanese", "German", "Chinese", "Korean", "Russian", "Arabic", "Hindi", "Portuguese", "Italian"];

const BUDGETS = [
  { value: "0-200", min: 0, max: 200 },
  { value: "200-500", min: 200, max: 500 },
  { value: "500-1000", min: 500, max: 1000 },
  { value: "1000+", min: 1000, max: Infinity },
];

const EXPERIENCE = [
  { value: "FRESHER", label: "New teachers (under 1 year)" },
  { value: "EXPERIENCED", label: "Experienced (1 year +)" },
];

const GENDERS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
];

const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "hours", label: "Most hours taught" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

function budgetLabel(min: number, max: number, symbol: string) {
  if (max === Infinity) return `${symbol}${min}+ / hour`;
  if (min === 0) return `Under ${symbol}${max} / hour`;
  return `${symbol}${min}–${symbol}${max} / hour`;
}

/** Recommended: teachers with open hours first, then rating weighted by how many reviews back it. */
function sortTeachers(list: Teacher[], sort: Sort) {
  const out = [...list];
  const score = (t: Teacher) => (t.availability ? 1 : 0) * 10 + t.rating * Math.min(1, t.reviews / 20);
  switch (sort) {
    case "rating":
      return out.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "price-asc":
      return out.sort((a, b) => a.hourlyRate - b.hourlyRate);
    case "price-desc":
      return out.sort((a, b) => b.hourlyRate - a.hourlyRate);
    case "hours":
      return out.sort((a, b) => (b.totalHours ?? 0) - (a.totalHours ?? 0));
    default:
      return out.sort((a, b) => score(b) - score(a));
  }
}

export function DiscoverScreen() {
  // Every filter outlives a navigation, so opening a teacher and coming back
  // returns to the same search.
  const [search, setSearch] = useStickyState("discover:search", "");
  const [language, setLanguage] = useStickyState<string | null>("discover:language", null);
  const [budget, setBudget] = useStickyState<string | null>("discover:budget", null);
  const [experience, setExperience] = useStickyState<string | null>("discover:experience", null);
  const [gender, setGender] = useStickyState<string | null>("discover:gender", null);
  const [availableOnly, setAvailableOnly] = useStickyState("discover:availableOnly", false);
  const [sort, setSort] = useStickyState<Sort>("discover:sort", "recommended");

  const settledSearch = useDebouncedValue(search, 300);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (settledSearch) params.set("search", settledSearch);
    if (language) params.set("language", language);
    const range = BUDGETS.find((r) => r.value === budget);
    if (range) {
      params.set("minRate", String(range.min));
      if (range.max !== Infinity) params.set("maxRate", String(range.max));
    }
    if (experience) params.set("experience", experience);
    if (gender) params.set("gender", gender);
    if (availableOnly) params.set("available", "true");
    return `/api/students/discover?${params.toString()}`;
  }, [settledSearch, language, budget, experience, gender, availableOnly]);

  const { data, error, isLoading, isStale, updatedAt, refetch } = useJsonResource<DiscoverPage>(url, {
    staleMs: 60_000,
  });

  // Later pages for the current filter set. student-web pages its results
  // 20 at a time; the old page only ever showed the first 20.
  const [more, setMore] = useState<{ url: string; teachers: Teacher[]; cursor: string | null; hasMore: boolean } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more?.url === url ? more : null;
  const hasMore = extra ? extra.hasMore : Boolean(data?.pagination?.hasMore);
  const nextCursor = extra ? extra.cursor : (data?.pagination?.nextCursor ?? null);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${url}&cursor=${encodeURIComponent(nextCursor)}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as DiscoverPage;
      setMore({
        url,
        teachers: [...(extra?.teachers ?? []), ...page.teachers],
        cursor: page.pagination?.nextCursor ?? null,
        hasMore: Boolean(page.pagination?.hasMore),
      });
    } catch {
      // The button stays, so another click retries.
    } finally {
      setLoadingMore(false);
    }
  };

  const symbol = getCurrencyInfo(data?.currency ?? "INR").symbol;
  const teachers = useMemo(() => {
    const seen = new Set<string>();
    const all = [...(data?.teachers ?? []), ...(extra?.teachers ?? [])].filter((t) => !seen.has(t.id) && seen.add(t.id));
    return sortTeachers(all, sort);
  }, [data, extra, sort]);
  const activeCount = [language, budget, experience, gender, availableOnly || null].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    setLanguage(null);
    setBudget(null);
    setExperience(null);
    setGender(null);
    setAvailableOnly(false);
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Find a teacher"
        description="Every teacher here has passed document checks, a live interview and a demo review."
      />

      {/* Search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search teachers</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-subtle" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by teacher name"
            className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-11 text-[15px] text-text shadow-level-1 outline-none transition-[border-color,box-shadow] placeholder:text-text-subtle hover:border-border-strong focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand)_14%,transparent)] [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-subtle hover:bg-surface-inset hover:text-text focus-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <Menu
          label="Sort"
          value={SORTS.find((s) => s.value === sort)!.label}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          selected={sort}
          onSelect={(v) => setSort((v ?? "recommended") as Sort)}
          required
          className="sm:w-56"
          tall
        />
      </div>

      {/* Languages */}
      {/* One scrolling row at every width; the fade says there is more to the right. */}
      <div className="-mx-4 overflow-x-auto px-4 hide-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)] md:mx-0 md:px-0">
        <div className="flex w-max gap-2 pr-10" role="group" aria-label="Language">
          <Chip active={language === null} onClick={() => setLanguage(null)}>
            All languages
          </Chip>
          {LANGUAGES.map((l) => (
            <Chip key={l} active={language === l} onClick={() => setLanguage(language === l ? null : l)}>
              {l}
            </Chip>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden items-center gap-1.5 text-[12px] font-semibold text-text-subtle sm:inline-flex">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </span>
        <Menu
          label="Budget"
          value={(() => {
            const r = BUDGETS.find((b) => b.value === budget);
            return r ? budgetLabel(r.min, r.max, symbol) : null;
          })()}
          options={BUDGETS.map((r) => ({ value: r.value, label: budgetLabel(r.min, r.max, symbol) }))}
          selected={budget}
          onSelect={setBudget}
        />
        <Menu label="Experience" value={EXPERIENCE.find((e) => e.value === experience)?.label ?? null} options={EXPERIENCE} selected={experience} onSelect={setExperience} />
        <Menu label="Teacher gender" value={GENDERS.find((g) => g.value === gender)?.label ?? null} options={GENDERS} selected={gender} onSelect={setGender} />
        <button
          type="button"
          role="switch"
          aria-checked={availableOnly}
          onClick={() => setAvailableOnly(!availableOnly)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-ring",
            availableOnly ? "border-trust/40 bg-trust/12 text-trust" : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
          )}
        >
          <span className={cn("relative h-2 w-2 rounded-full", availableOnly ? "bg-trust" : "bg-text-subtle/50")} aria-hidden />
          Has open hours
        </button>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="ml-1 text-[13px] font-semibold text-brand hover:underline focus-ring rounded">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {isStale && <StaleDataNotice onRetry={() => void refetch()} updatedAt={updatedAt} />}

      <p className="text-[13px] text-text-muted" aria-live="polite">
        {isLoading ? "Finding teachers…" : (
          <>
            <span className="font-bold text-text">{teachers.length}</span> {teachers.length === 1 ? "teacher" : "teachers"}
            {language ? ` teaching ${language}` : ""}
          </>
        )}
      </p>

      {error && !data ? (
        <ErrorState title="We couldn't load teachers" onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[300px] rounded-xl" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong">
          <EmptyState
            icon={SearchX}
            title="No teachers match"
            body={activeCount || search ? "Try another language, a wider budget or fewer filters." : "New teachers appear here as soon as they are approved."}
            action={
              activeCount || search ? (
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <motion.ul layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {teachers.map((t, i) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.35, delay: Math.min(i, 8) * 0.035, ease } }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              >
                <TeacherCard teacher={t} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {hasMore && !isLoading && teachers.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more teachers"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Teacher card ───────────────────────────────────────────────────────── */

function TeacherCard({ teacher: t }: { teacher: Teacher }) {
  const { href } = usePortal();
  const profile = href(`/teacher/${t.id}`);
  const isNew = t.experienceLevel === "FRESHER";
  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-level-1 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-level-2 motion-reduce:hover:translate-y-0">
      <div className="flex items-start gap-4">
        <Avatar name={t.name} src={t.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold tracking-[-0.015em] text-text">
            {/* The whole card opens the profile; the buttons below sit above this link. */}
            <Link href={profile} className="truncate after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:shadow-[0_0_0_3px_rgba(199,152,47,.45)]">
              {t.name}
            </Link>
            <BadgeCheck className="h-4 w-4 shrink-0 text-trust" aria-label="Verified teacher" />
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-text-muted">
            {t.reviews > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-text">
                <Star className="h-3.5 w-3.5 fill-action text-action" /> {t.rating.toFixed(1)}
                <span className="font-normal text-text-subtle">({t.reviews})</span>
              </span>
            ) : (
              <Pill tone="brand">New on Language Metrics</Pill>
            )}
            {!!t.totalHours && <span>· {coins(t.totalHours)} h taught</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.languages.filter(Boolean).map((l) => (
              <span key={l} className="rounded-md bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                {l}
              </span>
            ))}
            <span className="rounded-md bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
              {isNew ? "New teacher" : "Experienced"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 min-h-[40px] text-[13px] leading-[1.55] text-text-muted">{t.headline || "No introduction yet — open the profile to see availability and reviews."}</p>

      {/* `availability` means the teacher has published weekly hours, not that they are online. */}
      <div className="mt-4 flex items-center gap-2 text-[12px] font-medium">
        <Clock className={cn("h-3.5 w-3.5", t.availability ? "text-trust" : "text-text-subtle")} />
        <span className={t.availability ? "text-trust" : "text-text-subtle"}>
          {t.availability ? `Next opening · ${t.nextAvailable}` : "No weekly hours published yet"}
        </span>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between border-t border-border pt-4">
          <p>
            <span className="text-[20px] font-extrabold tracking-[-0.03em] tabular-nums text-text">
              {getCurrencyInfo(t.currency).symbol}
              {coins(t.hourlyRate)}
            </span>
            <span className="text-[12px] text-text-subtle"> / hour</span>
          </p>
          <p className="text-right text-[12px] text-text-muted">
            Demo <span className="font-bold text-text">{t.demoRate} coins</span>
            <span className="block text-[11px] text-text-subtle">45 min</span>
          </p>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={profile}>View profile</Link>
          </Button>
          <Button asChild variant="gold" size="sm" className="h-9">
            <Link href={href(`/teacher/${t.id}/book?option=demo`)}>Book a demo</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/* ── Controls ───────────────────────────────────────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-ring",
        active ? "border-brand bg-brand text-brand-on dark:text-navy" : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

/** A filter pill that opens a small list. Picking the selected option again clears it. */
function Menu({
  label,
  value,
  options,
  selected,
  onSelect,
  required,
  className,
  tall,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  /** Sort always has a value, so it never clears. */
  required?: boolean;
  className?: string;
  tall?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = !required && selected !== null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 border text-[13px] font-semibold transition-colors focus-ring",
          tall ? "h-12 rounded-xl px-4 shadow-level-1" : "h-9 rounded-full px-3.5",
          active ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
        )}
      >
        <span className="truncate">
          {required ? <span className="font-medium text-text-subtle">{label}: </span> : null}
          {value ?? label}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[220px] origin-top-left rounded-xl border border-border bg-surface p-1.5 shadow-lg sm:right-auto"
          >
            {options.map((o) => {
              const isSel = o.value === selected;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => {
                      onSelect(isSel && !required ? null : o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-inset focus-ring",
                      isSel ? "font-semibold text-text" : "text-text-muted"
                    )}
                  >
                    {o.label}
                    {isSel && <Check className="h-4 w-4 text-brand" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
