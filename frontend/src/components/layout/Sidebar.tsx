"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ActivitySquare,
  ClipboardPlus,
  LogOut,
  Settings2,
  Users2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { protocolAPI } from "@/lib/api";
import { UserSessionManager } from "@/stores/UserSessionManager";
import { cn, getInitials } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigationItems = [
  { href: ROUTES.PROTOCOLS, label: "Protocols", icon: ClipboardPlus },
  { href: ROUTES.PATIENTS, label: "Patients", icon: Users2 },
  { href: ROUTES.SIMULATION, label: "Simulation History", icon: ActivitySquare },
  { href: ROUTES.SETTINGS, label: "Settings", icon: Settings2 },
] as const;

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [protocolCount, setProtocolCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await protocolAPI.list();
        setProtocolCount(response.data?.length ?? 0);
      } catch (error) {
        console.error("Failed to load protocol count", error);
      }
    })();
  }, []);

  const handleSignOut = async (): Promise<void> => {
    UserSessionManager.getInstance().clear();
    await signOut({ redirectUrl: ROUTES.HOME });
  };

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-border/60 bg-sidebar/95 px-3 py-4 backdrop-blur lg:flex",
        collapsed ? "w-24" : "w-80",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <div className={cn("space-y-1", collapsed && "hidden")}>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">MediTwin</p>
          <p className="text-sm text-muted-foreground">Clinical eligibility command center</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {navigationItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const showProtocolCount = href === ROUTES.PROTOCOLS && protocolCount !== null && !collapsed;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                isActive
                  ? "border-cyan-400/30 bg-cyan-400/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
              {showProtocolCount ? (
                <span className="ml-auto rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                  {protocolCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-3xl border border-border/70 bg-card/65 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-sm font-semibold text-cyan-300">
            {getInitials(user?.firstName, user?.lastName, user?.primaryEmailAddress?.emailAddress)}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.fullName ?? "Trial Coordinator"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress ?? "Syncing profile"}
              </p>
            </div>
          ) : null}
        </div>
        <Button className="mt-3 w-full" variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Sign Out" : null}
        </Button>
      </div>
    </aside>
  );
}

