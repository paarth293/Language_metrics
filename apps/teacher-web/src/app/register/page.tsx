"use client";

import React from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { GraduationCap, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Create an account</h1>
        <p className="text-text-muted">Choose your account type to get started</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Link href="/register/student">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-6 hover:shadow-lg transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gold/10 text-gold flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-white transition-colors">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text mb-1">I&apos;m a Student</h2>
            <p className="text-sm text-text-muted">Sign up to book classes and learn</p>
          </motion.div>
        </Link>

        <Link href="/register/teacher">
          <motion.div 
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="flex flex-col h-full rounded-xl border border-border bg-surface p-6 hover:shadow-lg transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-brand-subtle text-brand flex items-center justify-center mb-4 group-hover:bg-brand group-hover:text-white transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-text mb-1">I&apos;m a Teacher</h2>
            <p className="text-sm text-text-muted">Apply to teach on our platform</p>
          </motion.div>
        </Link>
      </div>
      
      <p className="mt-8 text-center text-sm text-text-muted">
        Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
