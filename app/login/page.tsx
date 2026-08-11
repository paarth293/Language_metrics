"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Globe, ArrowRight, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already signed in? Send them to the right dashboard.
  useEffect(() => {
    if (isLoading || !user) return;
    if (user.role === "TEACHER") router.replace("/teacher/dashboard");
    else if (user.role === "ADMIN") router.replace("/admin/dashboard");
    else router.replace("/student/dashboard");
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await authApi.login(email, password);
      login(res.data.token, res.data.user);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #f8f4ea0a 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Gold orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Floating words */}
        {["Bonjour", "こんにちは", "Hola", "Namaste", "Ciao", "Merhaba"].map(
          (word, i) => (
            <motion.span
              key={i}
              className="font-script text-cream absolute opacity-[0.07]"
              style={{
                fontSize: `${1.2 + (i % 3) * 0.4}rem`,
                left: `${10 + (i * 15) % 70}%`,
                top: `${15 + (i * 13) % 70}%`,
              }}
              animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }}
              transition={{
                duration: 5 + i,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {word}
            </motion.span>
          )
        )}

        {/* Content */}
        <div className="relative z-10 text-center max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="w-16 h-16 bg-navy-2 border border-cream/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Globe className="w-8 h-8 text-gold" />
            </div>
            <h2 className="font-display font-bold text-cream text-3xl mb-4">
              Welcome back to{" "}
              <span className="text-gradient-gold italic">Language Metrics</span>
            </h2>
            <p className="text-cream/50 text-[15px] leading-relaxed">
              Your verified language teachers are waiting. Pick up where you left off.
            </p>

            {/* Testimonial */}
            <div className="mt-10 glass-dark p-5 rounded-2xl text-left">
              <p className="text-cream/70 text-[14px] italic mb-3">
                &ldquo;I went from zero to conversational French in 3 months. The teacher verification process really shows — my teacher was exceptional.&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-gold-soft flex items-center justify-center text-white text-xs font-bold">
                  A
                </div>
                <div>
                  <div className="text-cream text-[13px] font-semibold">Ananya R.</div>
                  <div className="text-cream/40 text-[11px]">French Student</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo (mobile) */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Globe className="w-4 h-4 text-gold" />
            </div>
            <span className="font-display font-semibold text-navy text-[16px]">
              Language Metrics
            </span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display font-bold text-navy text-3xl mb-2">
              Sign in
            </h1>
            <p className="text-navy/60 text-[15px]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register/student"
                className="text-gold font-semibold hover:underline"
              >
                Get started free
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-[14px]">{error}</p>
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-semibold text-navy/70 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-semibold text-navy/70"
                >
                  Password
                </label>
                <a
                  href="#"
                  className="text-[13px] text-gold hover:underline font-medium"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-navy/40 hover:text-navy transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 group disabled:opacity-60"
              id="login-submit"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-navy/10" />
            <span className="text-[12px] text-navy/40 font-medium">OR</span>
            <div className="flex-1 h-px bg-navy/10" />
          </div>

          {/* Role register links */}
          <div className="space-y-3">
            <p className="text-[13px] text-navy/50 text-center mb-4">
              Register as a different role:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/register/student"
                className="btn-outline py-3 text-[13px] font-semibold text-center"
                id="go-student-register"
              >
                Student
              </Link>
              <Link
                href="/register/teacher"
                className="btn-outline py-3 text-[13px] font-semibold text-center"
                id="go-teacher-register"
              >
                Teacher
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
