"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES } from "@/constants/routes";

interface HeaderProps {
  collapsed: boolean;
  onOpenMobileNav: () => void;
  onToggleSidebar: () => void;
}

const titleMap: Record<string, { title: string; subtitle: string }> = {
  [ROUTES.PROTOCOLS]: {
    title: "Protocol Command Center",
    subtitle: "Upload protocols, review extracted rules, and stage criteria confirmation.",
  },
  [ROUTES.PATIENTS]: {
    title: "Patient Screening Queue",
    subtitle: "Manage enriched patient records and compare pre-screen fit at scale.",
  },
  [ROUTES.SETTINGS]: {
    title: "Coordinator Settings",
    subtitle: "Review your Clerk identity and workspace preferences.",
  },
};

function resolveHeader(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith(ROUTES.SIMULATION)) {
    return {
      title: "Simulation Timeline",
      subtitle: "Inspect projected eligibility risk and reasoning traces across follow-up weeks.",
    };
  }

  return titleMap[pathname] ?? titleMap[ROUTES.PROTOCOLS];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function Header({ collapsed, onOpenMobileNav, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { title, subtitle } = resolveHeader(pathname);
  const greeting = getGreeting();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/80 px-4 py-4 backdrop-blur-xl md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2 items-center justify-center">
                <span className="live-dot-pulse block h-2 w-2 rounded-full bg-cyan-500" />
              </div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-800 dark:text-cyan-300/70">
                {greeting} • Patient Digital Twin
              </p>
            </div>
            <h1 className="text-lg font-semibold text-foreground md:text-2xl">{title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline">
            <Bell className="h-4 w-4" />
            Reasoning Alerts
          </Button>
        </div>
      </div>
    </header>
  );
}
