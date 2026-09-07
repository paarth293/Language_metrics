"use client";

/**
 * Client half of the "Invite Admin" flow (errors.md #F1). Kept as its own
 * component (rather than inlined into page.tsx, which is a Server
 * Component) since it needs local state for the open/closed panel and the
 * one-time temporary-password reveal.
 */

import { useActionState, useState } from "react";
import { UserPlus, X, Copy, Check, ShieldAlert } from "lucide-react";
import { inviteAdminAction } from "./actions";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "SUPPORT_ADMIN", label: "Support Admin" },
  { value: "CONTENT_ADMIN", label: "Content Admin" },
  { value: "TEACHER_ADMIN", label: "Teacher Admin" },
  { value: "FINANCE_ADMIN", label: "Finance Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export default function InviteAdminPanel({ canCreateSuperAdmin }: { canCreateSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(inviteAdminAction, null);

  function close() {
    setOpen(false);
    setCopied(false);
  }

  async function copyPassword() {
    if (!state?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(state.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) — the
      // password is still shown as plain text below, so this is non-fatal.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "var(--lm-accent)", color: "#000" }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity"
      >
        <UserPlus size={14} aria-hidden="true" />
        Invite Admin
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-admin-title"
        >
          <div
            style={{ background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" }}
            className="w-full max-w-[440px] rounded-xl p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <h2 id="invite-admin-title" style={{ color: "var(--lm-text)" }} className="text-[17px] font-bold">
                {state?.success ? "Admin account created" : "Invite a new admin"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                style={{ color: "var(--lm-text-subtle)" }}
                className="hover:opacity-70"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {state?.success ? (
              <div className="space-y-4">
                <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] leading-5">
                  <span style={{ color: "var(--lm-text)" }} className="font-semibold">
                    {state.createdEmail}
                  </span>{" "}
                  can now sign in with the temporary password below. They will be required to
                  set their own password immediately after their first login.
                </p>

                <div className="flex items-start gap-2 rounded-lg border border-[var(--lm-red)]/25 bg-[var(--lm-red-soft)] px-3 py-2.5">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" style={{ color: "var(--lm-red, #dc2626)" }} aria-hidden="true" />
                  <p className="text-[11px] leading-4" style={{ color: "var(--lm-red, #dc2626)" }}>
                    This password is shown only once and is not stored anywhere in plain text.
                    Share it with {state.createdEmail} over a secure channel now — you will not
                    be able to retrieve it again.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <code
                    style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border2)", color: "var(--lm-text)" }}
                    className="flex-1 rounded-lg px-3 py-2.5 text-[13px] font-mono tracking-wide select-all"
                  >
                    {state.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={copyPassword}
                    aria-label="Copy temporary password"
                    style={{ background: "var(--lm-bg)", border: "1px solid var(--lm-border2)", color: "var(--lm-text)" }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:opacity-80"
                  >
                    {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={close}
                  style={{ background: "var(--lm-accent)", color: "#000" }}
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] font-bold hover:opacity-90"
                >
                  Done
                </button>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <div>
                  <label htmlFor="invite-name" className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--lm-text)" }}>
                    Full name
                  </label>
                  <input
                    id="invite-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="off"
                    className="lm-input w-full px-3.5 text-[13px]"
                    placeholder="Priya Sharma"
                  />
                </div>

                <div>
                  <label htmlFor="invite-email" className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--lm-text)" }}>
                    Email
                  </label>
                  <input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                    className="lm-input w-full px-3.5 text-[13px]"
                    placeholder="priya@languagemetrics.com"
                  />
                </div>

                <div>
                  <label htmlFor="invite-role" className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--lm-text)" }}>
                    Role
                  </label>
                  <select id="invite-role" name="roleKey" required defaultValue="" className="lm-input w-full px-3.5 text-[13px]">
                    <option value="" disabled>
                      Select a role…
                    </option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value} disabled={r.value === "SUPER_ADMIN" && !canCreateSuperAdmin}>
                        {r.label}
                        {r.value === "SUPER_ADMIN" && !canCreateSuperAdmin ? " (Super Admins only)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {state?.error ? (
                  <p role="alert" className="rounded-lg border border-[var(--lm-red)]/25 bg-[var(--lm-red-soft)] px-3.5 py-2.5 text-[12px] font-semibold" style={{ color: "var(--lm-red, #dc2626)" }}>
                    {state.error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isPending}
                  style={{ background: "var(--lm-accent)", color: "#000" }}
                  className="w-full rounded-lg px-4 py-2.5 text-[13px] font-bold hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? "Creating…" : "Create admin account"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
