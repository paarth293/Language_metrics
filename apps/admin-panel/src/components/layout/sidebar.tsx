"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/rbac";
import { activeModuleForPath, visibleModules } from "./navigation";
import { ContextualNav } from "./contextual-nav";
import { PrimaryRail } from "./primary-rail";

export function Sidebar({ admin }: { admin: SessionUser }) {
  const pathname = usePathname();
  const modules = visibleModules(admin);
  const activeModule = activeModuleForPath(pathname, admin);
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div className="lm-sidebar-shell sticky top-0 z-40 flex h-dvh shrink-0">
      <PrimaryRail
        admin={admin}
        modules={modules}
        activeModule={activeModule.key}
        contextOpen={contextOpen}
        onToggleContext={() => setContextOpen((open) => !open)}
      />
      <ContextualNav
        admin={admin}
        pathname={pathname}
        activeModule={activeModule}
        open={contextOpen}
        onClose={() => setContextOpen(false)}
      />
      {contextOpen ? (
        <button
          type="button"
          aria-label="Close section navigation"
          className="fixed inset-0 z-40 hidden bg-[#102029]/45 backdrop-blur-[1px] max-[1100px]:block"
          onClick={() => setContextOpen(false)}
        />
      ) : null}
    </div>
  );
}
