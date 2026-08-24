"use client";

import React from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { GraduationCap, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Welcome back</h1>
        <p className="text-text-muted">Choose your account type to sign in</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Link href="/login/student">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-6 hover:shadow-lg transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gold/10 text-gold flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-white transition-colors">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text mb-1">I&apos;m a Student</h2>
            <p className="text-sm text-text-muted">Sign in to book classes and learn</p>
          </motion.div>
        </Link>

        <Link href="/login/teacher">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-6 hover:shadow-lg transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-navy/10 text-navy flex items-center justify-center mb-4 group-hover:bg-navy group-hover:text-white transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text mb-1">I&apos;m a Teacher</h2>
            <p className="text-sm text-text-muted">Sign in to manage your classes</p>
          </motion.div>
        </Link>
      </div>
      
      <p className="mt-8 text-center text-sm text-text-muted">
        Don&apos;t have an account? <Link href="/register/student" className="font-medium text-gold hover:underline">Sign up</Link>
      </p>
    </AuthLayout>
  );
}
