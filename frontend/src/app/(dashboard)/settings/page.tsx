"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivitySquare, AlertTriangle, Database, FolderOpen, Settings2, TestTube2, UserRound } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { patientAPI, protocolAPI, simulationAPI } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { PatientProfile, Protocol, SimulationListItem } from "@/types/models";

interface ActivityItem {
  id: string;
  title: string;
  timestamp: string;
  href: string;
}

function protocolActivity(protocol: Protocol): ActivityItem {
  const statusText =
    protocol.status === "CONFIRMED"
      ? "uploaded and confirmed"
      : protocol.status === "EXTRACTED"
        ? "uploaded and criteria extracted"
        : protocol.status === "FAILED"
          ? "upload failed"
          : "uploaded and processing";

  return {
    id: `protocol-${protocol.id}`,
    title: `Protocol "${protocol.name}" ${statusText}`,
    timestamp: protocol.updatedAt,
    href: `${ROUTES.PROTOCOLS}/${protocol.id}`,
  };
}

function simulationActivity(simulation: SimulationListItem): ActivityItem {
  return {
    id: `simulation-${simulation.id}`,
    title: `Simulation run for ${simulation.patientName} - ${simulation.compatibilityScore.toFixed(1)}% compatibility, ${simulation.overallRisk} risk`,
    timestamp: simulation.createdAt,
    href: `${ROUTES.SIMULATION}/${simulation.id}`,
  };
}

function OverviewCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </article>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [simulations, setSimulations] = useState<SimulationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const [protocolResponse, patientResponse, simulationResponse] = await Promise.all([
        protocolAPI.list(),
        patientAPI.list(),
        simulationAPI.list(),
      ]);

      setProtocols(protocolResponse.data ?? []);
      setPatients(patientResponse.data ?? []);
      setSimulations(simulationResponse.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load workspace overview.");
      setProtocols([]);
      setPatients([]);
      setSimulations([]);
    } finally {
      setLoading(false);
    }
  }

  const averageCompatibility = useMemo(() => {
    if (simulations.length === 0) return 0;
    return simulations.reduce((sum, simulation) => sum + simulation.compatibilityScore, 0) / simulations.length;
  }, [simulations]);

  const protocolBreakdown = useMemo(() => {
    const counts = protocols.reduce<Record<string, number>>((accumulator, protocol) => {
      accumulator[protocol.status] = (accumulator[protocol.status] ?? 0) + 1;
      return accumulator;
    }, {});

    const order = ["CONFIRMED", "EXTRACTED", "PROCESSING", "FAILED"];
    return order
      .filter((status) => counts[status])
      .map((status) => `${counts[status]} ${status.toLowerCase()}`)
      .join(", ");
  }, [protocols]);

  const activity = useMemo(() => {
    return [...protocols.map(protocolActivity), ...simulations.map(simulationActivity)]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 10);
  }, [protocols, simulations]);

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Workspace Overview" description="Activity, system context, and quick actions for the current coordinator workspace." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[1.75rem] border border-border/70 bg-card/50" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-[2rem] border border-border/70 bg-card/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Workspace Overview" description="Activity, system context, and quick actions for the current coordinator workspace." />
        <section className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Workspace overview failed to load</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button onClick={() => void loadOverview()}>Retry</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workspace Overview"
        description="Activity, system context, and quick actions for the current coordinator workspace."
        action={
          <Button variant="outline" onClick={() => void loadOverview()}>
            Refresh
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          label="Protocols Uploaded"
          value={protocols.length.toString()}
          hint={protocols.length > 0 ? protocolBreakdown : "No protocols uploaded yet"}
        />
        <OverviewCard
          label="Patients in Database"
          value={patients.length.toString()}
          hint="Browsable patient registry and screening cohort"
        />
        <OverviewCard label="Simulations Run" value={simulations.length.toString()} hint="Stored full simulation results" />
        <OverviewCard
          label="Avg Compatibility Score"
          value={`${averageCompatibility.toFixed(1)}%`}
          hint="Across all stored simulation runs"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
          <div className="flex items-center gap-3">
            <ActivitySquare className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Latest protocol and simulation events in chronological order</p>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={Settings2}
                title="No activity yet"
                description="Upload a protocol or run a simulation to populate the workspace feed."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {activity.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-start justify-between gap-4 rounded-[1.5rem] border border-border/60 bg-background/35 p-4 text-left transition hover:border-cyan-500/30 hover:bg-background/50"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.timestamp)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
                <p className="text-sm text-muted-foreground">Jump to the main coordinator workflows</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Button onClick={() => router.push(ROUTES.PROTOCOLS)}>Upload New Protocol</Button>
              <Button variant="outline" onClick={() => router.push(ROUTES.PATIENTS)}>Screen Patients</Button>
              <Button variant="outline" onClick={() => router.push(ROUTES.SIMULATION)}>View Simulation History</Button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
            <h2 className="text-xl font-semibold text-foreground">System Info</h2>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <div>
                    <p className="font-medium text-foreground">{user?.fullName ?? "Coordinator Profile"}</p>
                    <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress ?? "Loading Clerk profile"}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Clerk ID</dt>
                    <dd className="max-w-[16rem] truncate text-foreground">{user?.id ?? "Pending"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-foreground">{user?.createdAt ? formatDate(user.createdAt) : "Pending"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <div>
                    <p className="font-medium text-foreground">Connected to Supabase</p>
                    <p className="text-sm text-muted-foreground">Database connectivity assumed for this workspace</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
                <div className="flex items-center gap-3">
                  <TestTube2 className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  <div>
                    <p className="font-medium text-foreground">Groq - Llama 3.3 70B</p>
                    <p className="text-sm text-muted-foreground">Reasoning and extraction provider</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
                <p className="font-medium text-foreground">App Version</p>
                <p className="mt-1 text-sm text-muted-foreground">MediTwin 1.0.0</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
