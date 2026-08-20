"use client";

import { useActionState } from "react";
import Image from "next/image";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--lm-bg)] p-6">
      
      {/* Decorative Grid is already in globals.css for body */}
      
      <div 
        className="w-full max-w-[400px] p-8 rounded-2xl relative overflow-hidden"
        style={{ 
          background: "var(--lm-surface)", 
          border: "1px solid var(--lm-border)",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)"
        }}
      >
        {/* Subtle Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "var(--lm-accent)" }}></div>
        
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 mt-4">
          <span
            className="relative flex items-center justify-center overflow-hidden rounded-xl bg-[#f8f4ea] shadow-sm mb-4"
            style={{ width: 56, height: 56 }}
          >
            <Image
              src="/brand/logo-full.png"
              alt="Language Matrix Logo"
              fill
              sizes="56px"
              style={{
                objectFit: "cover",
                objectPosition: "50% 5%",
                transform: "scale(1.25)",
              }}
              priority
              draggable={false}
            />
          </span>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight mb-1">
            Language Matrix
          </h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">
            Admin Portal Access
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-5">
          <div>
            <label style={{ color: "var(--lm-text-subtle)" }} className="block text-[12px] font-bold uppercase tracking-wider mb-2">
              Admin Email
            </label>
            <input 
              name="email"
              type="email" 
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              style={{ 
                background: "var(--lm-bg)", 
                border: "1px solid var(--lm-border)",
                color: "var(--lm-text)"
              }}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:border-yellow-500/50 transition-colors"
              placeholder="admin@languagemetrics.com"
            />
          </div>

          <div>
            <label style={{ color: "var(--lm-text-subtle)" }} className="block text-[12px] font-bold uppercase tracking-wider mb-2">
              Password
            </label>
            <input 
              name="password"
              type="password" 
              required
              autoComplete="current-password"
              style={{ 
                background: "var(--lm-bg)", 
                border: "1px solid var(--lm-border)",
                color: "var(--lm-text)"
              }}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:border-yellow-500/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="text-red-500 text-sm font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center">
              {state.error}
            </p>
          )}

          <button 
            disabled={isPending}
            type="submit"
            style={{ 
              background: "var(--lm-accent)", 
              color: "#000" 
            }}
            className="w-full py-3 rounded-lg font-bold text-sm mt-4 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Authenticating..." : "Secure Login"}
          </button>
        </form>

        <p style={{ color: "var(--lm-text-subtle)" }} className="text-center text-[11px] font-medium mt-8">
          Authorized personnel only. All access is logged and rate-limited.
        </p>
      </div>
    </div>
  );
}
