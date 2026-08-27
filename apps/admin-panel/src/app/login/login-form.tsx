"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, Globe, ShieldCheck, Users, BookOpen } from "lucide-react";
import { loginAction } from "./actions";

export default function LoginForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const needs2FA = state?.error === "2FA_REQUIRED";

  return (
    <main className="grid min-h-screen bg-[var(--bg)] text-[var(--text)] lg:grid-cols-[1.15fr_0.85fr]">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          LEFT — brand panel
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative hidden overflow-hidden bg-[var(--brand-navy)] lg:flex lg:flex-col">

        {/* World-map texture — very subtle cream on navy */}
        <div className="pointer-events-none absolute inset-0 select-none">
          <Image
            src="/brand/mission-banner.png"
            alt=""
            fill
            sizes="55vw"
            className="object-cover object-center opacity-[0.06]"
            priority
            draggable={false}
          />
          {/* Radial fade so the edges stay dark and clean */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,transparent_40%,var(--brand-navy)_100%)]" />
        </div>

        {/* Inner layout */}
        <div className="relative z-10 flex flex-1 flex-col px-12 py-10 xl:px-16">

          {/* ── TOP: small wordmark ── */}
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#f8f4ea] ring-1 ring-white/10 shadow-md">
              <Image
                src="/brand/logo-full.png"
                alt="Language Metrics"
                fill
                sizes="36px"
                className="object-cover"
                style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }}
                priority
                draggable={false}
              />
            </div>
            <div>
              <p className="text-[13px] font-bold leading-tight text-white">Language Metrics</p>
              <p className="text-[10px] leading-tight text-white/40">Admin Portal</p>
            </div>
          </div>

          {/* ── MIDDLE: hero logo + copy ── */}
          <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8">

            {/* Full logo on cream — the brand hero */}
            <div className="group relative w-full max-w-[300px]">
              {/* Glow ring behind the card */}
              <div className="absolute -inset-3 rounded-[32px] bg-[var(--brand-gold)]/10 blur-xl transition-all duration-700 group-hover:bg-[var(--brand-gold)]/18" />
              {/* Cream card */}
              <div className="relative overflow-hidden rounded-3xl bg-[#f8f4ea] p-6 shadow-2xl ring-1 ring-white/10">
                <Image
                  src="/brand/logo-full.png"
                  alt="Language Metrics — Where Languages Connect People"
                  width={600}
                  height={600}
                  className="h-auto w-full object-contain"
                  draggable={false}
                />
              </div>
            </div>

            {/* Headline block */}
            <div className="w-full max-w-[340px] text-center">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--brand-gold)]">
                Secure Operations
              </p>
              <h1 className="text-[clamp(22px,2.4vw,32px)] font-semibold leading-[1.2] tracking-tight text-white">
                Keep the language network moving.
              </h1>
              <p className="mt-4 text-[13px] leading-[1.8] text-white/50">
                Review people, classes, payments, and platform signals that shape every learner&apos;s experience.
              </p>
            </div>

            {/* Trust stats */}
            <div className="flex w-full max-w-[340px] items-center justify-between divide-x divide-white/10">
              {[
                { icon: Globe,    value: "20+",    label: "Languages" },
                { icon: Users,    value: "1,200+", label: "Teachers"  },
                { icon: BookOpen, value: "50K+",   label: "Students"  },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex flex-1 flex-col items-center gap-1 px-4 first:pl-0 last:pr-0">
                  <Icon size={15} className="text-[var(--brand-gold)]" strokeWidth={1.8} aria-hidden="true" />
                  <span className="text-[16px] font-bold leading-tight text-white">{value}</span>
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM: footer ── */}
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-5 text-[10px] text-white/30">
            <span>Language Metrics · Admin</span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-gold)] opacity-70" />
              Encrypted · access logged
            </span>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          RIGHT — login form
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
        <div className="w-full max-w-[390px]">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-[#f8f4ea] ring-1 ring-[var(--border-strong)]">
              <Image
                src="/brand/logo-full.png"
                alt="Language Metrics"
                fill
                sizes="40px"
                className="object-cover"
                style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }}
                priority
                draggable={false}
              />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--text)]">Language Metrics</p>
              <p className="text-[11px] text-[var(--text-subtle)]">Admin Portal</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="lm-kicker mb-1">Authorized access</p>
            <h2 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">
              Welcome back.
            </h2>
            <p className="lm-body-copy mt-1">
              Sign in to access the Language Metrics operations workspace.
            </p>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-4">
            <span className="sr-only">2FA</span>
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-[12px] font-semibold text-[var(--text)]"
              >
                Admin email
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="admin@languagemetrics.com"
                className="lm-input w-full px-4 text-[13px]"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="admin-password"
                  className="block text-[12px] font-semibold text-[var(--text)]"
                >
                  Password
                </label>
                <span className="text-[10px] text-[var(--text-subtle)]">Required</span>
              </div>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="lm-input w-full px-4 pr-12 text-[13px]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
                >
                  {showPassword
                    ? <EyeOff size={15} aria-hidden="true" />
                    : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {needs2FA && (
              <div>
                <label htmlFor="admin-totp" className="mb-1.5 block text-[12px] font-semibold text-[var(--text)]">
                  Two-factor code
                </label>
                <input
                  id="admin-totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={10}
                  required
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code or backup code"
                  className="lm-input w-full px-4 text-[13px]"
                  autoFocus
                />
                <p className="mt-1.5 text-[10px] text-[var(--text-subtle)]">
                  Enter the code from your authenticator app, or a backup code.
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="trust-device"
                    name="trust_device"
                    className="h-3.5 w-3.5 rounded border-[var(--border-strong)] bg-transparent text-[var(--brand-navy)] focus:ring-[var(--brand-navy)]"
                  />
                  <label htmlFor="trust-device" className="text-[11px] text-[var(--text-subtle)]">
                    Don&apos;t ask again on this device for 30 days
                  </label>
                </div>
              </div>
            )}

            {state?.error && state.error !== "2FA_REQUIRED" ? (
              <p
                role="alert"
                className="rounded-lg border border-[var(--danger)]/25 bg-[var(--lm-red-soft)] px-4 py-3 text-[12px] font-semibold leading-5 text-[var(--danger)]"
              >
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="lm-button-primary mt-1 w-full gap-2 px-4"
            >
              {isPending ? "Authenticating…" : needs2FA ? "Verify & sign in" : "Continue to admin portal"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>

          {/* Security note */}
          <div className="mt-7 flex items-start gap-3 border-t border-[var(--border)] pt-5">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-[var(--success)]"
              aria-hidden="true"
            />
            <p className="text-[11px] leading-5 text-[var(--text-subtle)]">
              Access is logged, rate-limited, and protected for authorized personnel only.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
