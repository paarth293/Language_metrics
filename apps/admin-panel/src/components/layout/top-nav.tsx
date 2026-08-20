"use client";

import { Bell, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/rbac";

export function TopNav({ admin }: { admin: SessionUser }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header
      style={{ background: "var(--lm-bg)" }}
      className="h-[72px] px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-200"
    >
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={15} style={{ color: "var(--lm-text-subtle)" }} />
          <input
            type="text"
            placeholder="Search across portal..."
            style={{
              background: "var(--lm-surface)",
              color: "var(--lm-text)",
            }}
            className="w-full rounded-full py-2.5 pl-11 pr-4 text-[13px] font-medium placeholder-gray-500 outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 ml-4">
        <button style={{ color: "var(--lm-text-muted)" }} className="relative hover:text-white transition-colors">
          <Bell size={18} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 border-2 border-[#0A0A0A] rounded-full"></span>
        </button>

        {mounted && (
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{ color: "var(--lm-text-muted)" }} 
            className="hover:text-white transition-colors"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <button className="flex items-center justify-center overflow-hidden shrink-0 ml-2 rounded-full border border-gray-800 hover:border-gray-600 transition-colors">
          <img
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Admin&backgroundColor=transparent"
            alt="Avatar"
            className="w-8 h-8 object-cover bg-[#1A1A1A]"
          />
        </button>
      </div>
    </header>
  );
}
