"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  FileText,
  LifeBuoy,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  MonitorCog,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  UserX,
  Video,
} from "lucide-react";
import { useJsonResource } from "@repo/ui/useResource";
import { useStickyState } from "@repo/ui/useStickyState";
import { invalidateResource } from "@repo/ui/resource-cache";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { usePortal } from "../config";
import { ago } from "../format";
import { Dialog, EmptyState, ErrorState, InlineError, PageHeader, Panel, Pill, Segmented, Skeleton, ease, type PillTone } from "../primitives";

/* ══ FAQ ═══════════════════════════════════════════════════════════════════ */

type Qa = { q: string; a: React.ReactNode; text: string };

function qa(q: string, a: string): Qa {
  return { q, a, text: a };
}

/** A menu path ("Profile > Password") drawn with chevron icons instead of text arrows. */
function MenuPath({ steps }: { steps: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle font-semibold text-text">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-subtle" aria-label="then" />}
          {step}
        </React.Fragment>
      ))}
    </span>
  );
}

/** An answer that starts with a menu path; `text` keeps the words searchable. */
function qaPath(q: string, steps: string[], rest: string): Qa {
  return {
    q,
    a: (
      <>
        <MenuPath steps={steps} />. {rest}
      </>
    ),
    text: `${steps.join(" ")} ${rest}`,
  };
}

const FAQ: { id: string; label: string; icon: React.ElementType; items: Qa[] }[] = [
  {
    id: "start",
    label: "Getting started",
    icon: BookOpen,
    items: [
      qa("What is Language Metrics?", "Language Metrics connects you with verified language teachers for live 1-on-1 video classes, held in our own classroom — no Zoom or Meet links."),
      qa("How do I get started?", "Set your language and level in Profile, then open Find a teacher and book. Your first class with a teacher can be a demo: a 45-minute introductory session for 29 coins, one per teacher."),
      qa("Which languages can I learn?", "More than 40, including English, Spanish, French, German, Mandarin Chinese, Japanese, Korean, Russian, Arabic, Hindi and most Indian languages."),
    ],
  },
  {
    id: "classes",
    label: "Classes & booking",
    icon: CalendarClock,
    items: [
      qa("How do I book a class?", "Open Find a teacher, choose a teacher, check their open hours on their profile, pick a time and confirm. The class price is held from your coins when you book."),
      qa("Can I cancel or move a class?", "You can cancel free of charge up to 12 hours before the start, and the held coins come back in full. Cancellations within 12 hours are non-refundable. On My classes you can also move a class up to an hour earlier or later if the teacher is free."),
      qa("How do I join a live class?", "On your dashboard or in My classes, Join class appears 10 minutes before the start and stays until shortly after the class ends."),
      qa("What happens if I miss a class?", "If you don't join, the class is marked as a no-show and is not refunded."),
    ],
  },
  {
    id: "payments",
    label: "Coins & payments",
    icon: Coins,
    items: [
      qa("How do coins work?", "1 coin = ₹1 and coins never expire. Booking holds the class price; after the class you are charged only for the minutes taught and the rest is released back to your balance. Wallet shows both what you can spend and what is held."),
      qa("What payment methods are accepted?", "UPI, credit and debit cards, net banking and wallets, through Cashfree."),
      qa("My UPI payment is still processing. Should I pay again?", "No. UPI can take a few minutes to confirm. Your coins are added automatically once Cashfree confirms the payment."),
      qa("How do I get an invoice?", "Raise a support request with the category Payment issue and the payment date, and the team will send it to you."),
    ],
  },
  {
    id: "recordings",
    label: "Recordings",
    icon: Video,
    items: [
      qa("Are classes recorded?", "Your teacher can record a class. Recordings appear under Recordings once the class has finished."),
      qa("Why are some recordings locked?", "Some recordings have a small unlock fee. Once unlocked, a recording stays available to you."),
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    items: [
      qaPath("How do I change my password?", ["Profile", "Password"], "Enter your current password and a new one that meets the listed rules."),
      {
        q: "How do I turn on notifications?",
        a: (
          <>
            Everything appears under the bell at the top of every page. For browser alerts, go to <MenuPath steps={["Profile", "Notifications"]} /> and choose Turn on.
          </>
        ),
        text: "Everything appears under the bell at the top of every page. For browser alerts, go to Profile Notifications and choose Turn on.",
      },
      qaPath("How do I delete my account?", ["Profile", "Account", "Delete account"], "Cancel or finish any booked classes first; your data is removed within 30 days."),
    ],
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageCircle,
    items: [
      qa("Can I message a teacher before booking?", "Chat opens with a teacher once you have booked a class with them. All messages stay on Language Metrics."),
      qa("Do messages expire?", "Yes. Each conversation shows how long messages are kept, so save anything you want to keep."),
    ],
  },
];

export function FaqScreen() {
  const { href } = usePortal();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      FAQ.filter((c) => !category || c.id === category)
        .map((c) => ({ ...c, items: c.items.filter((i) => !q || i.q.toLowerCase().includes(q) || i.text.toLowerCase().includes(q)) }))
        .filter((c) => c.items.length > 0),
    [category, q]
  );
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-6 pb-10">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="relative overflow-hidden rounded-xl bg-navy px-6 py-10 text-center text-cream shadow-level-2 dark:border dark:border-gold/15 sm:py-12"
      >
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-xl">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[32px]">How can we help?</h1>
          <p className="mt-2 text-[14px] text-cream/65">Answers about booking, coins, classes and your account.</p>
          <label className="relative mt-6 block">
            <span className="sr-only">Search help</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try “cancel”, “UPI” or “join”"
              className="h-12 w-full rounded-xl border border-transparent bg-surface pl-11 pr-4 text-[15px] text-text shadow-lg outline-none placeholder:text-text-subtle focus:border-gold"
            />
          </label>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Topics">
        {FAQ.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors focus-ring",
                active ? "border-brand bg-brand/[0.06]" : "border-border bg-surface hover:border-border-strong"
              )}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", active ? "bg-brand text-brand-on dark:text-navy" : "bg-surface-inset text-text-muted")}>
                <c.icon className="h-4 w-4" />
              </span>
              <span className="text-[13px] font-semibold leading-tight text-text">{c.label}</span>
              <span className="text-[11px] text-text-subtle">{c.items.length} answers</span>
            </button>
          );
        })}
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            icon={Search}
            title={`Nothing found for “${query}”`}
            body="Try another word, or ask the team directly."
            action={
              <Button asChild variant="primary">
                <Link href={href("/support")}>Contact support</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.id} aria-labelledby={`faq-${s.id}`}>
              <h2 id={`faq-${s.id}`} className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-text-subtle">
                {s.label}
              </h2>
              <Panel className="divide-y divide-border overflow-hidden">
                {s.items.map((item) => {
                  const key = `${s.id}:${item.q}`;
                  const expanded = open === key || (!!q && total <= 3);
                  return (
                    <div key={key}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpen(open === key ? null : key)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-inset/50 focus-ring"
                      >
                        <span className="text-[14px] font-semibold text-text">{item.q}</span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-subtle transition-transform duration-200", expanded && "rotate-180")} />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease }}
                            className="overflow-hidden"
                          >
                            <p className="max-w-3xl px-5 pb-5 text-[14px] leading-relaxed text-text-muted">{item.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </Panel>
            </section>
          ))}
        </div>
      )}

      <Panel className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-action/15 text-gold-strong">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-text">Still need help?</p>
          <p className="text-[13px] text-text-muted">Raise a request and our team will get back to you. You can follow every request on the Support page.</p>
        </div>
        <Button asChild variant="primary">
          <Link href={href("/support")}>
            Contact support <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </Panel>
    </div>
  );
}

/* ══ Support ═══════════════════════════════════════════════════════════════ */

type TicketStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface Ticket {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  responses?: { message: string; createdAt: string; isAdmin: boolean }[];
}

const CATEGORIES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "PAYMENT_ISSUE", label: "Payment issue", icon: CreditCard },
  { value: "BOOKING_ISSUE", label: "Booking issue", icon: CalendarClock },
  { value: "TECHNICAL_ISSUE", label: "Technical problem", icon: MonitorCog },
  { value: "CLASS_QUALITY", label: "Class quality", icon: Star },
  { value: "TEACHER_BEHAVIOR", label: "Teacher behaviour", icon: ShieldCheck },
  { value: "REFUND_REQUEST", label: "Refund request", icon: Coins },
  { value: "ACCOUNT_ISSUE", label: "Account", icon: UserX },
  { value: "OTHER", label: "Something else", icon: MessageCircle },
];

const STATUS: Record<TicketStatus, { label: string; tone: PillTone }> = {
  PENDING: { label: "Waiting for the team", tone: "action" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  RESOLVED: { label: "Resolved", tone: "trust" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 2000;

export function SupportScreen() {
  const { href, fetch } = usePortal();
  const [filter, setFilter] = useStickyState<"open" | "done" | "all">("support:requests-filter", "all");
  const [composing, setComposing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, error, isLoading, refetch } = useJsonResource<{ tickets: Ticket[] }>("/api/students/complaints", { staleMs: 30_000 });
  const tickets = useMemo(() => data?.tickets ?? [], [data]);
  const openCount = tickets.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
  const shown = tickets.filter((t) =>
    filter === "all" ? true : filter === "open" ? t.status === "PENDING" || t.status === "IN_PROGRESS" : t.status === "RESOLVED" || t.status === "CLOSED"
  );

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Support"
        description="Tell us what went wrong and follow every request here."
        actions={
          <Button variant="primary" onClick={() => setComposing(true)}>
            <MessageSquarePlus className="h-4 w-4" /> New request
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href={href("/faq")} className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-text">Browse answers</span>
            <span className="block text-[12px] text-text-subtle">Most questions are answered in Help</span>
          </span>
          <ArrowRight className="h-4 w-4 text-text-subtle transition-transform group-hover:translate-x-0.5" />
        </Link>
        <a href="mailto:support@languagemetrics.com" className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-ring">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-trust/12 text-trust">
            <Mail className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-text">Email us</span>
            <span className="block truncate text-[12px] text-text-subtle">support@languagemetrics.com</span>
          </span>
        </a>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-action/15 text-gold-strong">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-text">{openCount ? `${openCount} open` : "Nothing open"}</span>
            <span className="block text-[12px] text-text-subtle">{openCount ? "The team is on it" : "All your requests are settled"}</span>
          </span>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 px-5 pb-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[15px] font-bold text-text">Your requests</h2>
          <Segmented
            label="Filter requests"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open", count: openCount },
              { value: "done", label: "Resolved" },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : error && !data ? (
          <ErrorState title="We couldn't load your requests" onRetry={() => void refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={tickets.length ? "Nothing in this view" : "No requests yet"}
            body={tickets.length ? "Try another filter." : "If something isn't right with a class, a payment or your account, tell us here."}
            action={
              tickets.length ? undefined : (
                <Button variant="primary" onClick={() => setComposing(true)}>
                  New request
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((t) => {
              const cat = CATEGORIES.find((c) => c.value === t.category);
              const Icon = cat?.icon ?? MessageCircle;
              const isOpen = expanded === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-surface-inset/50 focus-ring"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-inset text-text-muted">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-text">{t.subject}</span>
                      <span className="block text-[12px] text-text-subtle">
                        {cat?.label ?? "Request"} · opened {ago(t.createdAt)} · #{t.id.slice(0, 6).toUpperCase()}
                      </span>
                    </span>
                    <Pill tone={STATUS[t.status]?.tone ?? "neutral"} dot className="hidden sm:inline-flex">
                      {STATUS[t.status]?.label ?? t.status}
                    </Pill>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-subtle transition-transform", isOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }} className="overflow-hidden">
                        <div className="space-y-3 px-5 pb-5 sm:pl-[74px]">
                          <Pill tone={STATUS[t.status]?.tone ?? "neutral"} dot className="sm:hidden">
                            {STATUS[t.status]?.label ?? t.status}
                          </Pill>
                          <div className="rounded-xl bg-surface-inset/70 p-4">
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-text-subtle">You wrote</p>
                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{t.description}</p>
                          </div>
                          {t.responses?.map((r, i) => (
                            <div key={i} className={cn("rounded-xl p-4", r.isAdmin ? "border border-brand/20 bg-brand/[0.05]" : "bg-surface-inset/70")}>
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-text-subtle">
                                {r.isAdmin ? "Language Metrics team" : "You"} · {ago(r.createdAt)}
                              </p>
                              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{r.message}</p>
                            </div>
                          ))}
                          <p className="text-[12px] text-text-subtle">Last updated {ago(t.updatedAt)}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <NewRequestDialog
        open={composing}
        onClose={() => setComposing(false)}
        fetchImpl={fetch}
        onCreated={() => {
          invalidateResource("/api/students/complaints");
          setFilter("all");
        }}
      />
    </div>
  );
}

function NewRequestDialog({ open, onClose, onCreated, fetchImpl }: { open: boolean; onClose: () => void; onCreated: () => void; fetchImpl: typeof fetch }) {
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const valid = !!category && subject.trim().length >= 3 && description.trim().length >= 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return setError("Choose a topic and add a short subject and description.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetchImpl("/api/students/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category, subject: subject.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(body?.error || body?.message || "Your request could not be sent. Try again.");
      }
      setCategory("");
      setSubject("");
      setDescription("");
      onCreated();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your request could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-border bg-surface px-3.5 text-[14px] text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-subtle hover:border-border-strong focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand)_14%,transparent)]";

  return (
    <Dialog open={open} onClose={close} busy={busy} title="New support request" description="Include dates, teacher names or order IDs if you have them." className="sm:max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold text-text-secondary">What is it about?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <label
                  key={c.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors focus-within:ring-2 focus-within:ring-brand/40",
                    active ? "border-brand bg-brand/[0.06] text-text" : "border-border text-text-muted hover:border-border-strong"
                  )}
                >
                  <input type="radio" name="category" value={c.value} checked={active} onChange={() => setCategory(c.value)} className="sr-only" />
                  <c.icon className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-text-subtle")} />
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor="ticket-subject" className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
            Subject
          </label>
          <input id="ticket-subject" className={cn(input, "h-11")} value={subject} maxLength={SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} placeholder="Coins not added after UPI payment" />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="ticket-description" className="text-[12px] font-semibold text-text-secondary">
              What happened?
            </label>
            <span className="text-[11px] tabular-nums text-text-subtle">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <textarea id="ticket-description" rows={5} className={cn(input, "resize-none py-2.5")} value={description} maxLength={DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <InlineError>{error}</InlineError>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !valid}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ══ Terms & Privacy ═══════════════════════════════════════════════════════ */

type Clause = { title: string; body: React.ReactNode };

const mail = (address: string) => (
  <a href={`mailto:${address}`} className="font-semibold text-brand underline-offset-2 hover:underline">
    {address}
  </a>
);

// The legal wording is unchanged from the previous pages; only the layout is new.
const TERMS: Clause[] = [
  { title: "Acceptance of Terms", body: <>By accessing and using Language Metrics (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</> },
  { title: "Services", body: "Language Metrics provides an online platform connecting students with language teachers for live 1-on-1 video classes. The Platform includes features such as class booking, live video sessions, chat, recordings, and a virtual coin wallet." },
  { title: "User Accounts", body: "You must create an account to use the Platform. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must provide accurate and complete information during registration." },
  { title: "Payments & Refunds", body: "All payments are processed through Cashfree. Coins purchased on the Platform are non-transferable and non-refundable except as required by applicable law. Demo classes are non-refundable. Hourly and course bookings may be cancelled free of charge up to 12 hours before the scheduled start time. Cancellations within 12 hours are non-refundable." },
  { title: "Class Attendance", body: "Students may join a live class up to 10 minutes before the scheduled start time. If a student fails to join a session, it will be recorded as a no-show and no refund will be issued." },
  { title: "Code of Conduct", body: "Users must behave respectfully towards teachers and other users. Harassment, abuse, or inappropriate behavior during sessions or through chat will result in account suspension or termination." },
  { title: "Intellectual Property", body: "All content on the Platform, including course materials, recordings, and software, is the property of Language Metrics or its licensors and is protected by copyright laws. Recordings are for personal use only and may not be redistributed." },
  { title: "Limitation of Liability", body: "Language Metrics is not liable for any indirect, incidental, or consequential damages arising from the use of the Platform. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim." },
  { title: "Changes to Terms", body: "We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms." },
  { title: "Contact", body: <>For questions about these Terms, please contact us at {mail("support@languagemetrics.com")}</> },
];

const PRIVACY: Clause[] = [
  { title: "Information We Collect", body: "We collect information you provide directly: name, email, language preferences, payment information (processed securely via Cashfree), and communications with teachers. We also collect device tokens for push notifications when you opt in." },
  { title: "How We Use Your Information", body: "Your information is used to: provide and improve our services, process payments, connect you with teachers, send class reminders and notifications, ensure platform security, and communicate important updates." },
  { title: "Data Sharing", body: "We do not sell your personal information. We share data with teachers only as necessary for class delivery (name, language preferences). Payment data is handled exclusively by Cashfree and never stored on our servers." },
  { title: "Chat & Recordings", body: "Chat messages may be auto-deleted after a set period. Class recordings are stored securely and accessible only to the enrolled student and teacher. You can request deletion of recordings by contacting support." },
  { title: "Data Security", body: "We implement industry-standard security measures including encryption in transit (TLS), encrypted storage for sensitive data, and regular security audits. However, no method of transmission is 100% secure." },
  { title: "Your Rights", body: <>You have the right to: access your personal data, correct inaccurate data, request deletion of your data, export your data, and opt out of non-essential communications. To exercise these rights, contact us at {mail("privacy@languagemetrics.com")}</> },
  { title: "Account Deletion", body: "You may request account deletion through the Profile settings or by contacting support. Upon deletion, your personal data will be removed or anonymized within 30 days, except where retention is required by law." },
  { title: "Cookies", body: "We use essential cookies for authentication and session management. Optional analytics cookies help us improve the platform. You can manage cookie preferences through the cookie consent banner." },
  { title: "Changes to Policy", body: "We may update this Privacy Policy at any time. Significant changes will be communicated via email or in-app notification." },
  { title: "Contact", body: <>For privacy-related questions, contact our Data Protection Officer at {mail("privacy@languagemetrics.com")}</> },
];

const LEGAL = {
  terms: { title: "Terms of Service", updated: "January 2025", summary: "The rules for using Language Metrics as a student.", clauses: TERMS, icon: FileText },
  privacy: { title: "Privacy Policy", updated: "January 2025", summary: "What we collect, why, and the choices you have.", clauses: PRIVACY, icon: ShieldCheck },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function LegalScreen({ doc }: { doc: "terms" | "privacy" }) {
  const { href } = usePortal();
  const page = LEGAL[doc];
  const [active, setActive] = useState(slug(page.clauses[0]!.title));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );
    page.clauses.forEach((c) => {
      const el = document.getElementById(slug(c.title));
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [page]);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <div className="pb-10">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="mb-6 border-b border-border pb-6">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <page.icon className="h-5 w-5" />
        </span>
        <h1 className="lm-page-title">{page.title}</h1>
        <p className="mt-2 text-[14px] text-text-muted">{page.summary}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-subtle">
          <span>Last updated {page.updated}</span>
          <span aria-hidden>·</span>
          <Link href={href(doc === "terms" ? "/privacy" : "/terms")} className="font-semibold text-brand hover:underline">
            {doc === "terms" ? "Read the Privacy Policy" : "Read the Terms of Service"}
          </Link>
        </p>
      </motion.header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page">
          {/* Mobile: a compact jump list; desktop: a sticky table of contents. */}
          <details className="rounded-xl border border-border bg-surface lg:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-text">On this page</summary>
            <ol className="space-y-0.5 px-2 pb-2">
              {page.clauses.map((c, i) => (
                <li key={c.title}>
                  <a href={`#${slug(c.title)}`} onClick={jump(slug(c.title))} className="block rounded-lg px-2 py-1.5 text-[13px] text-text-muted hover:bg-surface-inset">
                    {i + 1}. {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
          <ol className="sticky top-4 hidden space-y-0.5 border-l border-border lg:block">
            {page.clauses.map((c, i) => {
              const id = slug(c.title);
              const on = active === id;
              return (
                <li key={c.title}>
                  <a
                    href={`#${id}`}
                    onClick={jump(id)}
                    className={cn("-ml-px block border-l-2 py-1.5 pl-4 text-[13px] transition-colors", on ? "border-action font-semibold text-text" : "border-transparent text-text-muted hover:text-text")}
                  >
                    <span className="tabular-nums text-text-subtle">{i + 1}.</span> {c.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <article className="max-w-[68ch] space-y-8">
          {page.clauses.map((c, i) => (
            <section key={c.title} id={slug(c.title)} className="scroll-mt-6">
              <h2 className="flex items-baseline gap-3 text-[17px] font-bold tracking-[-0.015em] text-text">
                <span className="text-[13px] font-bold tabular-nums text-gold-strong">{String(i + 1).padStart(2, "0")}</span>
                {c.title}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.75] text-text-muted">{c.body}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
