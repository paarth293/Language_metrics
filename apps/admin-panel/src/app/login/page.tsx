"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <main className="grid min-h-screen bg-[var(--lm-paper)] text-[var(--lm-ink)] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[var(--lm-slate-950)] px-14 py-12 text-[#ffffff] lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full border border-[#6cc7ba]/20 bg-[#23414a]/55" />
        <div className="absolute bottom-24 right-16 h-36 w-36 rounded-[32px] border border-[#6cc7ba]/20 bg-[#2c5a5c]/35 rotate-12" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] bg-[#f8f4ea] ring-1 ring-white/10">
            <Image src="/brand/logo-full.png" alt="Language Metrics logo" fill sizes="44px" className="object-cover" style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }} priority draggable={false} />
          </span>
          <div>
            <p className="text-[13px] font-bold tracking-tight">Language Metrics</p>
            <p className="mt-1 text-[11px] text-[#91b0b3]">Admin Portal</p>
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10 max-w-[480px]"
        >
          <span className="lm-status lm-status--teal bg-[#2d5a5b] text-[#b5e4dc]">Secure operations workspace</span>
          <h1 className="mt-7 max-w-[460px] text-[clamp(36px,4vw,58px)] font-semibold leading-[1.02] tracking-[-0.065em] text-[#f3fbf9]">Keep the language network moving.</h1>
          <p className="mt-6 max-w-[430px] text-[15px] leading-7 text-[#9eb7b9]">Review the people, classes, payments, and platform signals that shape every learner&apos;s experience.</p>
        </motion.div>

        <div className="relative z-10 flex items-center justify-between gap-6 border-t border-white/[0.1] pt-5 text-[11px] text-[#78909a]">
          <span>South Asia · production workspace</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#72c5ba]" />Encrypted access</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-14 xl:px-24">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.38, ease: "easeOut" }}
          className="w-full max-w-[430px]"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#f8f4ea] ring-1 ring-[var(--lm-line)]">
              <Image src="/brand/logo-full.png" alt="Language Metrics logo" fill sizes="40px" className="object-cover" style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }} priority draggable={false} />
            </span>
            <div><p className="text-[13px] font-bold text-[var(--lm-ink-strong)]">Language Metrics</p><p className="mt-1 text-[11px] text-[var(--lm-muted)]">Admin Portal</p></div>
          </div>

          <div className="mb-9">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]"><LockKeyhole size={20} aria-hidden="true" /></div>
            <p className="lm-kicker">Authorized access</p>
            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.055em] text-[var(--lm-ink-strong)]">Welcome back.</h2>
            <p className="lm-body-copy mt-2">Sign in to access the Language Metrics operations workspace.</p>
          </div>

          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-[12px] font-bold text-[var(--lm-ink)]">Admin email</label>
              <input id="admin-email" name="email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="admin@languagemetrics.com" className="lm-input w-full px-4 text-[13px]" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="admin-password" className="block text-[12px] font-bold text-[var(--lm-ink)]">Password</label><span className="text-[10px] text-[var(--lm-subtle)]">Required</span></div>
              <div className="relative">
                <input id="admin-password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" className="lm-input w-full px-4 pr-12 text-[13px]" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--lm-subtle)] hover:bg-[var(--lm-hover)] hover:text-[var(--lm-ink)]">{showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
              </div>
            </div>

            {state?.error ? <p role="alert" className="rounded-xl border border-[var(--lm-red)]/25 bg-[var(--lm-red-soft)] px-3.5 py-3 text-[12px] font-semibold leading-5 text-[var(--lm-red)]">{state.error}</p> : null}

            <button type="submit" disabled={isPending} className="lm-button-primary mt-2 w-full px-4">{isPending ? "Authenticating…" : "Continue to admin portal"}<ArrowUpRight size={16} aria-hidden="true" /></button>
          </form>

          <div className="mt-8 flex items-start gap-3 border-t border-[var(--lm-line)] pt-5">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--lm-teal)]" aria-hidden="true" />
            <p className="text-[11px] leading-5 text-[var(--lm-muted)]">Access is logged, rate-limited, and protected for authorized personnel only.</p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
