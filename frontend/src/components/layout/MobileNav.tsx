"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActivitySquare, ClipboardPlus, LogOut, Settings2, Users2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { UserSessionManager } from "@/stores/UserSessionManager";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

const navigationItems = [
  { href: ROUTES.PROTOCOLS, label: "Protocols", icon: ClipboardPlus },
  { href: ROUTES.PATIENTS, label: "Patients", icon: Users2 },
  { href: ROUTES.SIMULATION, label: "Simulation History", icon: ActivitySquare },
  { href: ROUTES.SETTINGS, label: "Settings", icon: Settings2 },
] as const;

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = async (): Promise<void> => {
    UserSessionManager.getInstance().clear();
    await signOut({ redirectUrl: ROUTES.HOME });
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-black/70 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative ml-auto flex h-full w-[88vw] max-w-sm flex-col border-l border-border/70 bg-sidebar/95 p-5 shadow-2xl backdrop-blur transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">MediTwin</p>
            <p className="text-sm text-muted-foreground">Eligibility workspace</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-2">
          {navigationItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                  isActive
                    ? "border-cyan-400/30 bg-cyan-400/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/70 hover:text-foreground",
                )}
                onClick={onClose}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rounded-3xl border border-border/70 bg-card/65 p-4">
          <p className="text-sm font-medium text-foreground">{user?.fullName ?? "Trial Coordinator"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.primaryEmailAddress?.emailAddress ?? "Syncing profile"}
          </p>
          <Button className="mt-4 w-full" variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
