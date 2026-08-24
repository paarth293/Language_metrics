"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Check } from "lucide-react";
import { changePasswordAction } from "./actions";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => router.push("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [state?.success, router]);

  return (
    <div className="mx-auto max-w-[520px] px-6 py-12">
      <div className="mb-8">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]">
          <KeyRound size={20} aria-hidden="true" />
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--lm-ink-strong)]">
          Change your password
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--lm-muted)]">
          Your administrator account requires a password update. Choose a strong, unique password that you don't use anywhere else.
        </p>
      </div>

      {state?.success ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--lm-teal)]/25 bg-[var(--lm-teal-soft)] px-4 py-4 text-[13px] font-semibold text-[var(--lm-teal-deep)]">
          <Check size={18} aria-hidden="true" />
          Password updated successfully. Redirecting…
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="mb-2 block text-[12px] font-bold text-[var(--lm-ink)]">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="lm-input w-full px-4 text-[13px]"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-2 block text-[12px] font-bold text-[var(--lm-ink)]">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="lm-input w-full px-4 text-[13px]"
            />
            <p className="mt-1.5 text-[10px] text-[var(--lm-muted)]">
              Min 12 characters · uppercase · lowercase · number · special character
            </p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-[12px] font-bold text-[var(--lm-ink)]">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="lm-input w-full px-4 text-[13px]"
            />
          </div>

          {state?.error ? (
            <p role="alert" className="rounded-xl border border-[var(--lm-red)]/25 bg-[var(--lm-red-soft)] px-3.5 py-3 text-[12px] font-semibold leading-5 text-[var(--lm-red)]">
              {state.error}
            </p>
          ) : null}

          <button type="submit" disabled={isPending} className="lm-button-primary mt-2 w-full px-4">
            {isPending ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
