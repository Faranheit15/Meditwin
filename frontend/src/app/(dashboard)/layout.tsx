"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { UserSessionManager } from "@/stores/UserSessionManager";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const sessionManager = UserSessionManager.getInstance();
  useMediaQuery("(max-width: 1023px)");
  const [collapsed, setCollapsed] = useState<boolean>(() => sessionManager.getSidebarCollapsed());
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    sessionManager.setSidebarCollapsed(collapsed);
  }, [collapsed, sessionManager]);

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background lg:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header
            collapsed={collapsed}
            onOpenMobileNav={() => setMobileOpen(true)}
            onToggleSidebar={() => setCollapsed((value) => !value)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
