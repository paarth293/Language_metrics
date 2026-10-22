"use client";

import React, { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@repo/ui/cn";
import { Button } from "@repo/ui/Button";
import { initials } from "./format";

/* ── Motion presets ─────────────────────────────────────────────────────── */

/** One shared easing so every surface in the portal moves the same way. */
export const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Page entrance: children rise in one after another. Used once per screen, so
 * the motion reads as the page arriving rather than as scattered effects.
 */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function Rise({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "header" | "aside" }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
      }}
    >
      {children}
    </Comp>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

const AVATAR_TONES = [
  "bg-brand/12 text-brand",
  "bg-trust/12 text-trust",
  "bg-action/18 text-gold-strong",
  "bg-accent/15 text-accent",
];

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
}

const AVATAR_SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-[13px]",
  lg: "h-14 w-14 text-[16px]",
  xl: "h-20 w-20 text-[22px]",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  online,
  tone,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  /** Shows a teal dot — "available now" or "in class". */
  online?: boolean;
  /** Overrides the name-derived colours, e.g. on the navy hero card. */
  tone?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full font-bold tracking-[-0.02em]",
          AVATAR_SIZES[size],
          !src && (tone ?? toneFor(name))
        )}
      >
        {src ? (
          <Image unoptimized src={src} alt="" width={80} height={80} className="h-full w-full object-cover" />
        ) : (
          initials(name)
        )}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 h-[30%] max-h-3.5 w-[30%] max-w-3.5 rounded-full border-2 border-surface bg-trust"
          aria-hidden
        />
      )}
    </span>
  );
}

/* ── Pills ──────────────────────────────────────────────────────────────── */

const PILL_TONES = {
  neutral: "bg-surface-inset text-text-muted",
  brand: "bg-brand/10 text-brand",
  trust: "bg-trust/12 text-trust",
  action: "bg-action/15 text-gold-strong",
  alert: "bg-alert/10 text-alert",
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", dot, children, className }: { tone?: PillTone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5", PILL_TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/* ── Page header ────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="lm-page-title">{title}</h1>
        {description && <p className="mt-1.5 text-[13px] text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface shadow-level-1", className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, meta, action }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold tracking-[-0.01em] text-text">{title}</h2>
        {meta && <p className="mt-0.5 text-[12px] text-text-subtle">{meta}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Segmented tabs ─────────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-surface-inset p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-ring",
              active ? "text-text" : "text-text-muted hover:text-text"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-surface shadow-[0_1px_2px_rgba(15,12,41,.08),0_1px_8px_-2px_rgba(15,12,41,.08)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.label}
              {o.count !== undefined && o.count > 0 && (
                <span className="rounded-full bg-brand/10 px-1.5 text-[10px] font-bold leading-4 text-brand">{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── States ─────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-inset", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-inset text-text-subtle">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <p className="text-[15px] font-bold text-text">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Panel className="w-full max-w-sm p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-alert" />
        <h2 className="text-[15px] font-bold text-text">{title}</h2>
        <p className="mb-5 mt-1 text-[13px] text-text-muted">Check your connection and try again.</p>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </Panel>
    </div>
  );
}

export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-start gap-2 rounded-lg border border-alert/25 bg-alert-subtle px-3 py-2 text-[13px] text-alert-hover", className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/* ── Overlays ───────────────────────────────────────────────────────────── */

const noop = () => () => {};

/**
 * Overlays render into <body>. Rendered in place, a `fixed` panel inside the
 * top bar was sized to the bar: its backdrop-filter makes it the containing
 * block for fixed descendants.
 */
function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}

/** Esc to close, focus moved in on open and back out on close. */
function useOverlay(open: boolean, onClose: () => void, busy: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose, busy, ref]);
}

/**
 * Centred dialog on larger screens, bottom sheet on phones. `busy` locks it
 * open while a request it started is still running.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  busy = false,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, busy, ref);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            key="dialog"
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-[#0b0920]/45 backdrop-blur-[2px]" onClick={() => !busy && onClose()} aria-hidden />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ y: 28, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease }}
              className={cn(
                "relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 shadow-lg outline-none sm:max-w-md sm:rounded-2xl",
                className
              )}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
              <div className="mb-4 flex items-start gap-3">
                {icon}
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-[17px] font-bold tracking-[-0.015em] text-text">
                    {title}
                  </h2>
                  {description && <div className="mt-1 text-[13px] leading-relaxed text-text-muted">{description}</div>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  aria-label="Close"
                  className="-mr-2 -mt-1 rounded-lg p-2 text-text-subtle transition-colors hover:bg-surface-inset hover:text-text disabled:opacity-40 focus-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Panel that slides in from the right edge. */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, false, ref);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div key="sheet" className="fixed inset-0 z-50" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
            <motion.div
              className="absolute inset-0 bg-[#0b0920]/30 backdrop-blur-[1px]"
              onClick={onClose}
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.aside
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              tabIndex={-1}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease }}
              className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-lg outline-none"
            >
              {children}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
