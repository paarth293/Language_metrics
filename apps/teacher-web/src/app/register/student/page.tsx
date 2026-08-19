"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function StudentRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate auth API call
    setTimeout(() => {
      setIsLoading(false);
      setSuccess(true);
      setTimeout(() => {
        router.push("/student/discover"); // Demo redirect
      }, 1500);
    }, 1500);
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-up">
          <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text mb-2">Account Created!</h2>
          <p className="text-text-muted">Taking you to your dashboard...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Start learning</h1>
        <p className="text-text-muted">Create a free student account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Full name</label>
          <Input 
            type="text" 
            placeholder="John Doe" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Email address</label>
          <Input 
            type="email" 
            placeholder="name@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Password</label>
          <Input 
            type="password" 
            placeholder="Create a strong password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          {/* Simple password strength meter mock */}
          <div className="flex gap-1 mt-2">
            <div className={`h-1 flex-1 rounded-full ${password.length > 0 ? 'bg-danger' : 'bg-surface-inset'}`} />
            <div className={`h-1 flex-1 rounded-full ${password.length > 5 ? 'bg-warning' : 'bg-surface-inset'}`} />
            <div className={`h-1 flex-1 rounded-full ${password.length > 8 ? 'bg-success' : 'bg-surface-inset'}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">I want to learn</label>
            <select 
              className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
            >
              <option value="" disabled>Select language...</option>
              <option value="spanish">Spanish 🇪🇸</option>
              <option value="french">French 🇫🇷</option>
              <option value="japanese">Japanese 🇯🇵</option>
              <option value="english">English 🇬🇧</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">My level is</label>
            <select 
              className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="beginner">Beginner (A1)</option>
              <option value="elementary">Elementary (A2)</option>
              <option value="intermediate">Intermediate (B1-B2)</option>
              <option value="advanced">Advanced (C1-C2)</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-4" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
