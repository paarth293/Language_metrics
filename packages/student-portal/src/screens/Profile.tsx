"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Bell, Check, Eye, EyeOff, GraduationCap, KeyRound, Loader2, Trash2, UserRound, X } from "lucide-react";
import { LANGUAGES, getLanguageConfig, getLevelsForLanguage } from "@repo/languages";
import { CURRENCIES } from "@repo/currency";
import { useJsonResource } from "@repo/ui/useResource";
import { invalidateResource } from "@repo/ui/resource-cache";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { usePortal } from "../config";
import { LevelLadder, levelInfo } from "../LevelLadder";
import { Avatar, Dialog, ErrorState, InlineError, Panel, Pill, Skeleton, ease } from "../primitives";

type ProfileData = {
  profile: {
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    languageToLearn: string;
    proficiencyLevel: string;
    preferredCurrency: string;
    status: string;
    onboardingComplete: boolean;
    totalBookings: number;
    completedBookings: number;
    memberSince: string;
  };
};

type Form = { name: string; avatarUrl: string; languageToLearn: string; proficiencyLevel: string; preferredCurrency: string };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "security", label: "Password", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Trash2 },
] as const;

/** Stored values are lowercase language names; the picker uses the same. */
const languageValue = (stored: string) => getLanguageConfig(stored)?.name.toLowerCase() ?? stored.toLowerCase();

function formFrom(p: ProfileData["profile"]): Form {
  return {
    name: p.name,
    avatarUrl: p.avatarUrl ?? "",
    languageToLearn: languageValue(p.languageToLearn ?? ""),
    proficiencyLevel: p.proficiencyLevel ?? "",
    preferredCurrency: p.preferredCurrency || "INR",
  };
}

const field =
  "h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-[14px] text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-subtle hover:border-border-strong focus:border-brand focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand)_14%,transparent)] disabled:opacity-60";

export function ProfileScreen() {
  const { fetch } = usePortal();
  // Focus revalidation is off and the form is seeded once per mount: a
  // background payload landing mid-edit must not discard what was typed.
  const { data, isLoading, refetch } = useJsonResource<ProfileData>("/api/students/profile", {
    staleMs: 60_000,
    revalidateOnFocus: false,
  });

  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [active, setActive] = useState<string>("profile");

  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    const f = formFrom(data.profile);
    setSaved(f);
    setForm(f);
  }, [data]);

  // Highlight the section being read in the side navigation.
  useEffect(() => {
    if (!form) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [form]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = useMemo(() => !!form && !!saved && (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k]), [form, saved]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (isLoading || (data && !form)) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-[140px] rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
          <Skeleton className="hidden h-56 rounded-xl lg:block" />
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
      </div>
    );
  }
  if (!data || !form || !saved) return <ErrorState title="We couldn't load your profile" onRetry={() => void refetch()} />;

  const p = data.profile;
  const set = (patch: Partial<Form>) => {
    setSaveError(null);
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const save = async () => {
    if (!form.name.trim()) {
      setSaveError("Enter your name.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/students/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          avatarUrl: form.avatarUrl.trim(),
          languageToLearn: form.languageToLearn,
          ...(form.proficiencyLevel ? { proficiencyLevel: form.proficiencyLevel } : {}),
          preferredCurrency: form.preferredCurrency,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string; errors?: string[] } | null;
        throw new Error(body?.errors?.[0] || body?.error || body?.message || "Your changes could not be saved. Try again.");
      }
      // Name, avatar and currency show up on the dashboard and in prices
      // across the app, so mark the student keys stale.
      invalidateResource("/api/students/");
      setSaved(form);
      setToast("Profile saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Your changes could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const memberSince = new Date(p.memberSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const learning = levelInfo(form.languageToLearn, form.proficiencyLevel);

  return (
    <div className="space-y-5 pb-28">
      {/* Identity */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="relative overflow-hidden rounded-xl bg-navy p-6 text-cream shadow-level-2 dark:border dark:border-gold/15"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={form.name || p.name} src={form.avatarUrl || null} size="xl" tone="bg-cream/12 text-gold" className="self-start rounded-full ring-4 ring-cream/10 sm:self-auto" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.03em]">{form.name || p.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-cream/65">
              {p.email}
              {p.emailVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-trust/20 px-2 py-0.5 text-[11px] font-semibold text-[#7ee2bf]">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </p>
            <p className="mt-2 text-[12px] text-cream/50">Member since {memberSince}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { k: "Booked", v: p.totalBookings },
              { k: "Completed", v: p.completedBookings },
              { k: "Level", v: learning.current?.shortLabel ?? "—" },
            ].map((s) => (
              <div key={s.k} className="min-w-[84px] rounded-xl bg-cream/[0.07] px-3 py-2.5 text-center">
                <dd className="text-[20px] font-extrabold tabular-nums">{s.v}</dd>
                <dt className="text-[11px] text-cream/55">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Section nav */}
        <nav aria-label="Profile sections" className="hidden lg:block">
          <ul className="sticky top-4 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setActive(s.id);
                  }}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors focus-ring",
                    active === s.id ? "text-text" : "text-text-muted hover:text-text"
                  )}
                >
                  {active === s.id && (
                    <motion.span layoutId="profile-nav" className="absolute inset-0 rounded-lg bg-surface shadow-level-1" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                  )}
                  <s.icon className="relative h-4 w-4" />
                  <span className="relative">{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <Section id="profile" title="Profile" description="How teachers see you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="profile-name">
                <input id="profile-name" className={field} value={form.name} maxLength={50} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
              </Field>
              <Field label="Email" htmlFor="profile-email" hint="Your sign-in email can't be changed here.">
                <input id="profile-email" className={field} value={p.email} disabled readOnly />
              </Field>
              <Field label="Photo link" htmlFor="profile-photo" hint="Paste a link to a square JPG or PNG. The preview above updates as you type." className="sm:col-span-2">
                <div className="flex items-center gap-3">
                  <Avatar name={form.name || p.name} src={form.avatarUrl || null} size="md" />
                  <input
                    id="profile-photo"
                    className={field}
                    value={form.avatarUrl}
                    placeholder="https://"
                    inputMode="url"
                    onChange={(e) => set({ avatarUrl: e.target.value })}
                  />
                  {form.avatarUrl && (
                    <button type="button" onClick={() => set({ avatarUrl: "" })} aria-label="Remove photo" className="rounded-lg p-2 text-text-subtle hover:bg-surface-inset hover:text-text focus-ring">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Field>
            </div>
          </Section>

          <Section id="learning" title="Learning" description="Teachers use your level to pitch each class.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Language you're learning" htmlFor="profile-language">
                <select
                  id="profile-language"
                  className={field}
                  value={form.languageToLearn}
                  onChange={(e) => {
                    const next = e.target.value;
                    const keep = getLevelsForLanguage(next).some((l) => l.value === form.proficiencyLevel);
                    set({ languageToLearn: next, proficiencyLevel: keep ? form.proficiencyLevel : "" });
                  }}
                >
                  <option value="">Choose a language</option>
                  {LANGUAGES.map((l) => (
                    // No flag emoji: Windows renders them as two letters ("ES").
                    <option key={l.code} value={l.name.toLowerCase()}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Show prices in" htmlFor="profile-currency" hint="Teacher rates are converted to this currency.">
                <select id="profile-currency" className={field} value={form.preferredCurrency} onChange={(e) => set({ preferredCurrency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {form.languageToLearn && (
              <div className="mt-5 rounded-xl border border-border bg-surface-inset/50 p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-semibold text-text">
                    Your level <span className="font-normal text-text-subtle">· {learning.system}</span>
                  </p>
                  {learning.label ? <Pill tone="action">{learning.label}</Pill> : <span className="text-[12px] text-alert">Pick a level</span>}
                </div>
                <LevelLadder language={form.languageToLearn} value={form.proficiencyLevel} onChange={(v) => set({ proficiencyLevel: v })} />
                <p className="mt-3 min-h-[20px] text-[13px] text-text-muted">{learning.description ?? "Tap the step that matches you best."}</p>
              </div>
            )}
          </Section>

          <PasswordSection />
          <NotificationsSection />
          <DangerSection />
        </div>
      </div>

      {/* Save bar: only there while something has changed. */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:left-[256px]"
          >
            <div role="region" aria-label="Unsaved changes" className="flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-text">You have unsaved changes</p>
                {saveError && <p className="mt-0.5 text-[12px] text-alert">{saveError}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none" disabled={saving} onClick={() => { setForm(saved); setSaveError(null); }}>
                  Discard
                </Button>
                <Button variant="primary" size="sm" className="h-9 flex-1 sm:flex-none" disabled={saving} onClick={() => void save()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast} />
    </div>
  );
}

/* ── Building blocks ────────────────────────────────────────────────────── */

function Section({ id, title, description, children, tone }: { id: string; title: string; description?: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <Panel id={id} className={cn("scroll-mt-6 p-5 sm:p-6", tone === "danger" && "border-alert/30")}>
      <h2 className={cn("text-[16px] font-bold tracking-[-0.015em]", tone === "danger" ? "text-alert" : "text-text")}>{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-text-subtle">{hint}</p>}
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-navy px-4 py-3 text-[13px] font-semibold text-cream shadow-lg dark:border dark:border-border"
        >
          <Check className="h-4 w-4 text-[#7ee2bf]" /> {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Password ───────────────────────────────────────────────────────────── */

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
];

function PasswordSection() {
  const { fetch } = usePortal();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The same rules as sign-up, so a changed password is never weaker than a new account's.
  const passes = RULES.every((r) => r.test(next));
  const matches = next.length > 0 && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (!passes) return setError("Your new password doesn't meet every requirement yet.");
    if (!matches) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/students/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(body?.error || body?.message || "Your password could not be changed.");
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your password could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <Section id="security" title="Password" description="Use at least 8 characters, with upper- and lowercase letters and a number.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password" htmlFor="pw-current" className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
          <div className="relative">
            <input id="pw-current" type={type} autoComplete="current-password" className={cn(field, "pr-11")} value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passwords" : "Show passwords"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-subtle hover:text-text focus-ring">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label="New password" htmlFor="pw-new">
          <input id="pw-new" type={type} autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} required aria-describedby="pw-rules" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm">
          <input
            id="pw-confirm"
            type={type}
            autoComplete="new-password"
            className={cn(field, confirm && !matches && "border-alert/60")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <ul id="pw-rules" className="grid gap-1.5 sm:col-span-2 sm:grid-cols-4">
          {RULES.map((r) => {
            const ok = r.test(next);
            return (
              <li key={r.label} className={cn("flex items-center gap-1.5 text-[12px] transition-colors", ok ? "text-trust" : "text-text-subtle")}>
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", ok ? "border-trust bg-trust text-white" : "border-border-strong")}>
                  {ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
        {error && <InlineError className="sm:col-span-2">{error}</InlineError>}
        {done && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-trust/10 px-3 py-2 text-[13px] font-medium text-trust sm:col-span-2">
            <Check className="h-4 w-4" /> Password changed.
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" variant="outline" disabled={busy || !current || !next || !confirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ── Notifications ──────────────────────────────────────────────────────── */

type Permission = "granted" | "denied" | "default" | "unsupported";

function NotificationsSection() {
  const { fetch } = usePortal();
  const [permission, setPermission] = useState<Permission>(() =>
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : (Notification.permission as Permission)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only turning on is offered here. The old switch could be flipped "off",
  // but that only changed the label: the browser kept delivering.
  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as Permission);
      if (result !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
      });
      const res = await fetch("/api/students/device-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: JSON.stringify(subscription), platform: "web" }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setError("This browser could not be registered for alerts. Try again, or use another browser.");
    } finally {
      setBusy(false);
    }
  };

  const state = {
    granted: { title: "Browser alerts are on", body: "You'll get alerts for classes about to start and new messages. To turn them off, use your browser's site settings.", tone: "trust" as const },
    denied: { title: "Browser alerts are blocked", body: "Allow notifications for this site in your browser's settings, then reload this page.", tone: "alert" as const },
    default: { title: "Browser alerts are off", body: "Get an alert when a class is about to start or a teacher messages you.", tone: "neutral" as const },
    unsupported: { title: "Not available in this browser", body: "Your notifications still appear under the bell at the top of every page.", tone: "neutral" as const },
  }[permission];

  return (
    <Section id="notifications" title="Notifications" description="Everything also appears under the bell at the top of the page.">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-inset/50 p-4 sm:flex-row sm:items-center">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", state.tone === "trust" ? "bg-trust/12 text-trust" : state.tone === "alert" ? "bg-alert/10 text-alert" : "bg-surface text-text-muted")}>
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-text">{state.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{state.body}</p>
        </div>
        {permission === "default" && (
          <Button variant="primary" size="sm" className="h-9" onClick={() => void enable()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Turn on
          </Button>
        )}
      </div>
      {error && <InlineError className="mt-3">{error}</InlineError>}
    </Section>
  );
}

/* ── Account ────────────────────────────────────────────────────────────── */

function DangerSection() {
  const { fetch } = usePortal();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const close = () => {
    setOpen(false);
    setText("");
    setError(null);
  };

  const submit = async () => {
    if (text !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/students/profile/request-deletion", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(body?.error || body?.message || "The request could not be sent. Try again.");
      }
      setRequested(true);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The request could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="account" title="Delete account" tone="danger">
      {requested ? (
        <p role="status" className="rounded-lg bg-surface-inset px-4 py-3 text-[13px] text-text-muted">
          Deletion requested. Your account and data will be removed within 30 days.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-[13px] leading-relaxed text-text-muted">
            Removes your profile, bookings and messages within 30 days. Cancel or finish any booked classes first.
          </p>
          <Button variant="outline" className="shrink-0 hover:border-alert/50 hover:text-alert" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </div>
      )}

      <Dialog
        open={open}
        onClose={close}
        busy={busy}
        title="Delete your account?"
        icon={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-alert/10 text-alert">
            <Trash2 className="h-5 w-5" />
          </span>
        }
        description="This can't be undone once it has been processed."
      >
        <label htmlFor="delete-confirm" className="mb-1.5 block text-[13px] text-text-muted">
          Type <span className="font-bold text-text">DELETE</span> to confirm
        </label>
        <input id="delete-confirm" className={field} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="DELETE" />
        {error && <InlineError className="mt-3">{error}</InlineError>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} disabled={busy}>
            Keep account
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={text !== "DELETE" || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete account
          </Button>
        </div>
      </Dialog>
    </Section>
  );
}
