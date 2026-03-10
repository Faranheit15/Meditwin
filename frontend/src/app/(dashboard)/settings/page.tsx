"use client";

import { useUser } from "@clerk/nextjs";
import { Settings2, UserRound } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { formatDate } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Workspace preferences, coordinator profile metadata, and future audit controls will live here."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{user?.fullName ?? "Coordinator Profile"}</h2>
              <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress ?? "Loading Clerk profile"}</p>
            </div>
          </div>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clerk User ID</dt>
              <dd className="mt-2 break-all text-sm text-foreground">{user?.id ?? "Pending"}</dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Created</dt>
              <dd className="mt-2 text-sm text-foreground">
                {user?.createdAt ? formatDate(user.createdAt) : "Pending"}
              </dd>
            </div>
          </dl>
        </section>

        <EmptyState
          icon={Settings2}
          title="Preference controls are still to be built."
          description="Theme overrides, protocol review defaults, webhook settings, and audit preferences will be added after the core screening and simulation flows are connected."
        />
      </div>
    </div>
  );
}
