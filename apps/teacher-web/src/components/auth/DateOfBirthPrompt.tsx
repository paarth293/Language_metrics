"use client";

import React, { useState } from "react";
import { Cake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MIN_AGE, dateOfBirthSchema, latestBirthDate } from "@/features/auth/validators/auth";
import type { Role } from "@/types";

/**
 * Blocking one-time prompt for accounts created before date of birth was
 * collected at signup. Rendered by AppShell in place of the page content.
 */
export function DateOfBirthPrompt({ role, onSaved }: { role: Role; onSaved: () => Promise<void> }) {
  const minAge = role === "TEACHER" ? MIN_AGE.TEACHER : MIN_AGE.STUDENT;
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = dateOfBirthSchema(minAge).safeParse(dateOfBirth);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Please enter a valid date of birth.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/date-of-birth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth }),
      });
      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Could not save your date of birth.");
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your date of birth.");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Cake className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-[20px] font-bold text-text mb-2">One more detail</h1>
          <p className="text-sm text-text-muted mb-5">
            We now ask every member for their date of birth. Please add yours to continue.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label htmlFor="dob-prompt" className="text-sm font-medium text-text">Date of birth</label>
              <Input
                id="dob-prompt"
                type="date"
                value={dateOfBirth}
                max={latestBirthDate(minAge)}
                onChange={(e) => { setDateOfBirth(e.target.value); setError(null); }}
                aria-invalid={!!error}
                aria-describedby={error ? "dob-prompt-error" : undefined}
                className={error ? "border-danger focus:ring-danger" : ""}
              />
              {error && <p id="dob-prompt-error" role="alert" className="text-xs text-danger mt-1">{error}</p>}
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
