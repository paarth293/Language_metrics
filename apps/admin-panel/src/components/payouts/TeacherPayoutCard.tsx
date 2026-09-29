"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayout } from "@/app/(dashboard)/teachers/[id]/actions";

export function TeacherPayoutCard({ teacherId, payouts }: { teacherId: string, payouts: any[] }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await createPayout(teacherId, Number(amount), note || "Bonus");
      setAmount("");
      setNote("");
      router.refresh();
    } catch (err) {
      alert("Failed to allocate payout");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div style={cardStyle} className="rounded-lg p-6 mt-6">
      <h2 className="text-lg font-semibold text-white mb-4">Payouts & Bonuses</h2>
      
      <form onSubmit={handleAllocate} className="mb-6 space-y-3 pb-6 border-b border-gray-700">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
            placeholder="e.g. 500"
            required
            min="1"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Note / Reference</label>
          <input 
            type="text" 
            value={note} 
            onChange={e => setNote(e.target.value)} 
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm"
            placeholder="e.g. Performance Bonus"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Allocating..." : "Allocate Payout / Bonus"}
        </button>
      </form>

      <h3 className="text-sm font-semibold text-white mb-3">Recent Payouts</h3>
      {payouts.length === 0 ? (
        <p className="text-sm text-gray-400">No payouts allocated yet.</p>
      ) : (
        <ul className="space-y-3">
          {payouts.map((p) => (
            <li key={p.id} className="text-sm border-b border-gray-700 pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between gap-3">
                <span className="text-white">{p.transactionRef || "Payout"}</span>
                <span className="tabular-nums font-medium text-green-400">
                  +₹{p.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-900/30 px-1.5 py-0.5 rounded">
                  {p.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
