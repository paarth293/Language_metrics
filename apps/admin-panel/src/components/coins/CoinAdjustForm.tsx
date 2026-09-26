"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Minus, Plus, ShieldCheck } from "lucide-react";

type Direction = "CREDIT" | "DEBIT";

const MAX_SINGLE = 10_000;

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500";

/**
 * Two-step form: fill in the adjustment, then review it and confirm with your
 * password (and 2FA code). The request id is fixed when the review step opens,
 * so resubmitting after a network error cannot apply the adjustment twice.
 */
export function CoinAdjustForm({
  userId,
  spendable,
  requiresTotp,
}: {
  userId: string;
  spendable: number;
  requiresTotp: boolean;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<Direction>("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showTotp, setShowTotp] = useState(requiresTotp);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountNum = Number(amount);
  const amountValid = Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= MAX_SINGLE;
  const debitTooLarge = direction === "DEBIT" && amountValid && amountNum > spendable;
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;
  const canReview = amountValid && reasonValid && !debitTooLarge;

  function openReview() {
    setError(null);
    setSuccess(null);
    setRequestId(crypto.randomUUID());
  }

  function cancelReview() {
    setRequestId(null);
    setPassword("");
    setTotpCode("");
    setError(null);
  }

  async function confirm() {
    if (!requestId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          direction,
          amount: amountNum,
          reason: reason.trim(),
          requestId,
          password,
          totpCode: totpCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "TOTP_REQUIRED") setShowTotp(true);
        setError(data.message ?? "Adjustment failed.");
        return;
      }
      setSuccess(
        `${direction === "CREDIT" ? "Added" : "Removed"} ${amountNum.toLocaleString("en-IN")} coins. ` +
          `New spendable balance: ${data.balance.balance.toLocaleString("en-IN")}.`
      );
      setAmount("");
      setReason("");
      cancelReview();
      router.refresh();
    } catch {
      setError("Network error — nothing was lost. Press confirm again to retry safely.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requestId) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-yellow-500/30 bg-yellow-900/20 p-3 text-sm">
          <p className="text-yellow-300 font-semibold mb-1">Confirm adjustment</p>
          <p className="text-white">
            {direction === "CREDIT" ? "Add" : "Remove"}{" "}
            <span className="font-bold tabular-nums">{amountNum.toLocaleString("en-IN")}</span> coins{" "}
            {direction === "CREDIT" ? "to" : "from"} this account.
          </p>
          <p className="text-gray-400 text-xs mt-1 break-words">Reason: {reason.trim()}</p>
        </div>

        <label className="block">
          <span className="text-xs text-gray-400">Your admin password</span>
          <input
            type="password"
            autoComplete="current-password"
            className={`${inputClass} mt-1`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {showTotp && (
          <label className="block">
            <span className="text-xs text-gray-400">Authenticator code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputClass} mt-1 tracking-widest`}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelReview}
            disabled={submitting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting || !password || (showTotp && totpCode.length !== 6)}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={16} /> {submitting ? "Applying…" : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white flex items-center gap-2">
        <Coins size={16} /> Adjust coins
      </p>

      <div className="grid grid-cols-2 gap-2">
        {(["CREDIT", "DEBIT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded text-sm border transition-colors ${
              direction === d
                ? d === "CREDIT"
                  ? "bg-green-900/40 border-green-500/50 text-green-300"
                  : "bg-red-900/40 border-red-500/50 text-red-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {d === "CREDIT" ? <Plus size={14} /> : <Minus size={14} />}
            {d === "CREDIT" ? "Add" : "Remove"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs text-gray-400">Coins (1 – {MAX_SINGLE.toLocaleString("en-IN")})</span>
        <input
          type="number"
          min={1}
          max={MAX_SINGLE}
          step={1}
          className={`${inputClass} mt-1`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      {debitTooLarge && (
        <p className="text-xs text-red-400">Only {spendable.toLocaleString("en-IN")} spendable coins can be removed.</p>
      )}

      <label className="block">
        <span className="text-xs text-gray-400">Reason (shown in the ledger and audit log)</span>
        <textarea
          rows={2}
          maxLength={500}
          className={`${inputClass} mt-1 resize-none`}
          placeholder="e.g. Compensation for class cancelled by teacher"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {success && <p className="text-sm text-green-400">{success}</p>}

      <button
        type="button"
        onClick={openReview}
        disabled={!canReview}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Review
      </button>
    </div>
  );
}
