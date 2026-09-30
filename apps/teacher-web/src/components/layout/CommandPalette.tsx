"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import type { NavItem } from "./AppShell";

type Student = { id: string; name: string; level: string; avatar: string | null };

type Result =
  | { kind: "page"; id: string; label: string; hint: string; href: string; icon: React.ElementType }
  | { kind: "student"; id: string; label: string; hint: string; href: string; student: Student };

// Extra words people type when they mean a page ("availability" → Schedule).
const PAGE_KEYWORDS: Record<string, string> = {
  dashboard: "home overview",
  schedule: "calendar availability working hours week classes timetable",
  students: "learners people",
  earnings: "payouts wallet coins money income",
  sessions: "classes bookings lessons join past upcoming",
  profile: "settings bio pricing rates account documents video",
  notifications: "alerts inbox updates",
  classes: "sessions lessons bookings",
  discover: "find teachers browse",
  wallet: "coins payments money",
};

const initialsOf = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

type Props = {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  canSearchStudents: boolean;
};

export function CommandPalette({ open, onClose, navItems, canSearchStudents }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [students, setStudents] = useState<Student[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on every opening.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Students load lazily, once, the first time the palette opens.
  useEffect(() => {
    if (!open || !canSearchStudents || students !== null) return;
    fetch("/api/teachers/students", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) =>
        setStudents(
          (d.students ?? []).map((s: Student) => ({ id: s.id, name: s.name, level: s.level, avatar: s.avatar }))
        )
      )
      .catch(() => setStudents([]));
  }, [open, canSearchStudents, students]);

  const q = query.trim().toLowerCase();

  const pages = useMemo<Result[]>(() => {
    return navItems
      .filter((item) => {
        if (!q) return true;
        const key = item.href.split("/").pop() ?? "";
        return `${item.label} ${PAGE_KEYWORDS[key] ?? ""}`.toLowerCase().includes(q);
      })
      .map((item) => ({ kind: "page", id: item.href, label: item.label, hint: "Page", href: item.href, icon: item.icon }));
  }, [navItems, q]);

  const people = useMemo<Result[]>(() => {
    if (!q || !students) return [];
    return students
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((s) => ({
        kind: "student",
        id: s.id,
        label: s.name,
        hint: s.level,
        href: `/teacher/students?q=${encodeURIComponent(s.name)}`,
        student: s,
      }));
  }, [students, q]);

  const results = useMemo(() => [...people, ...pages], [people, pages]);
  const studentsLoading = canSearchStudents && students === null && q !== "";
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const go = (r: Result) => {
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      const next = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) go(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  const renderGroup = (title: string, items: Result[], offset: number) =>
    items.length > 0 && (
      <div role="group" aria-label={title} className="py-1.5">
        <div className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          {title}
        </div>
        {items.map((r, i) => {
          const index = offset + i;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${r.kind}-${r.id}`}
              id={`palette-option-${index}`}
              data-index={index}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseMove={() => active !== index && setActive(index)}
              onClick={() => go(r)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-brand/10" : "hover:bg-surface-inset"
              )}
            >
              {r.kind === "page" ? (
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isActive ? "bg-brand text-brand-on" : "bg-surface-inset text-text-muted"
                  )}
                >
                  <r.icon className="h-4 w-4" />
                </span>
              ) : (
                <Avatar
                  src={r.student.avatar || undefined}
                  alt={r.student.name}
                  initials={initialsOf(r.student.name)}
                  size="sm"
                  className="shrink-0"
                />
              )}
              <span className={cn("min-w-0 flex-1 truncate text-[14px] font-medium", isActive ? "text-text" : "text-text-secondary")}>
                {r.label}
              </span>
              <span className="shrink-0 text-[12px] text-text-subtle">{r.hint}</span>
              <CornerDownLeft className={cn("h-3.5 w-3.5 shrink-0 text-text-subtle", !isActive && "invisible")} aria-hidden />
            </button>
          );
        })}
      </div>
    );

  // Portalled to <body>: the header's backdrop blur would otherwise trap this
  // fixed overlay inside the header's box.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 shrink-0 text-text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={canSearchStudents ? "Search pages and students…" : "Search pages…"}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results.length ? `palette-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-text-subtle outline-none"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-surface-inset px-1.5 py-0.5 text-[11px] font-medium text-text-subtle sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id="palette-results" role="listbox" className="overflow-y-auto px-2 py-1">
          {studentsLoading && (
            <div className="flex items-center gap-2.5 px-3 py-3 text-[13px] text-text-muted" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching students…
            </div>
          )}
          {results.length === 0 ? (
            !studentsLoading && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <SearchX className="h-6 w-6 text-text-subtle" />
              <p className="text-[14px] font-semibold text-text">No results for “{query.trim()}”</p>
              <p className="text-[13px] text-text-muted">
                {canSearchStudents ? "Try a page name or a student's name." : "Try a different page name."}
              </p>
            </div>
            )
          ) : (
            <>
              {renderGroup("Students", people, 0)}
              {renderGroup(q ? "Pages" : "Go to", pages, people.length)}
            </>
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-border bg-surface-inset/50 px-4 py-2.5 text-[11px] text-text-subtle sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1">↑</kbd>
            <kbd className="rounded border border-border bg-surface px-1">↓</kbd> to move
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1">↵</kbd> to open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-surface px-1">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
