"use client";

import React from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { GraduationCap, BookOpen, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="mb-6 text-center sm:text-left flex flex-col items-center sm:items-start">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-muted hover:text-text mb-2 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <h1 className="font-display text-[28px] font-bold text-text mb-1">Welcome back</h1>
        <p className="text-text-muted">Choose your account type to sign in</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Link href="/login/student">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-5 hover:shadow-glow-gold hover:border-action/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gold/10 text-gold flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-white transition-colors">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-1 group-hover:text-gold-strong transition-colors">I&apos;m a Student</h2>
            <p className="text-sm text-text-muted">Sign in to book classes and learn</p>
          </motion.div>
        </Link>

        <Link href="/login/teacher">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-5 hover:shadow-glow-blue hover:border-brand/30 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4 group-hover:bg-brand group-hover:text-white transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-1 group-hover:text-brand transition-colors">I&apos;m a Teacher</h2>
            <p className="text-sm text-text-muted">Sign in to manage your classes</p>
          </motion.div>
        </Link>
      </div>
      
      <p className="mt-6 text-center text-sm text-text-muted">
        Don&apos;t have an account? <Link href="/register" className="inline-flex min-h-11 items-center -my-3 font-medium text-gold-strong hover:underline">Sign up</Link>
      </p>
    </AuthLayout>
  );
}
