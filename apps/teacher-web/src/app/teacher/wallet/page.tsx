"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function WalletRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    router.replace("/teacher/earnings");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="text-sm text-text-muted">Redirecting to Earnings…</span>
      </div>
    </div>
  );
}
