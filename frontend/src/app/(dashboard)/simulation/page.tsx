"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, History, RefreshCcw } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ExportMenu } from "@/components/common/ExportMenu";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { simulationAPI } from "@/lib/api";
import { cn, formatDate, formatRelativeTime, formatRiskLabel } from "@/lib/utils";
import type { SimulationListItem } from "@/types/models";

function compatibilityTone(score: number): string {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "text-amber-700 dark:text-amber-200";
  return "text-rose-700 dark:text-rose-200";
}

function riskBadgeTone(risk: SimulationListItem["overallRisk"]): string {
  switch (risk) {
    case "LOW":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200";
    case "MEDIUM":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100";
    case "HIGH":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200";
  }
}

function sexLabel(sex: SimulationListItem["patientSex"]): string {
  return sex === "MALE" ? "Male" : "Female";
}

function HistorySkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[1.75rem] border border-border/70 bg-card/50" />
        ))}
      </div>
      <div className="rounded-[2rem] border border-border/70 bg-card/50 p-5">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-[1.25rem] border border-border/60 bg-background/35" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, toneClassName }: { label: string; value: string; hint?: string; toneClassName?: string }) {
  return (
    <article className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-3xl font-semibold text-foreground", toneClassName)}>{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </article>
  );
}

export default function SimulationHistoryPage() {
  const router = useRouter();
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const [simulations, setSimulations] = useState<SimulationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSimulations();
  }, []);

  async function loadSimulations() {
    setLoading(true);
    setError(null);
    try {
      const response = await simulationAPI.list();
      setSimulations(response.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load simulations.");
      setSimulations([]);
    } finally {
      setLoading(false);
    }
  }

  const exportRows = useMemo(
    () =>
      simulations.map((simulation) => ({
        id: simulation.id,
        patientName: simulation.patientName,
        patientAge: simulation.patientAge,
        patientSex: simulation.patientSex,
        protocolName: simulation.protocolName,
        compatibilityScore: simulation.compatibilityScore,
        overallRisk: simulation.overallRisk,
        evaluationCount: simulation.evaluationCount,
        flaggedCount: simulation.flaggedCount,
        createdAt: simulation.createdAt,
      })),
    [simulations],
  );

  const stats = useMemo(() => {
    const total = simulations.length;
    const avgCompatibility =
      total === 0 ? 0 : simulations.reduce((sum, simulation) => sum + simulation.compatibilityScore, 0) / total;
    const highRisk = simulations.filter((simulation) => simulation.overallRisk === "HIGH").length;
    const protocolCount = new Set(simulations.map((simulation) => simulation.protocolId)).size;
    return { total, avgCompatibility, highRisk, protocolCount };
  }, [simulations]);

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Simulation History"
          description="Review past eligibility simulations and compare results across patients and protocols"
        />
        <HistorySkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Simulation History"
          description="Review past eligibility simulations and compare results across patients and protocols"
        />
        <section className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Simulation history failed to load</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button onClick={() => void loadSimulations()}>Retry</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Simulation History"
        description="Review past eligibility simulations and compare results across patients and protocols"
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {simulations.length > 0 ? (
              <ExportMenu
                fileBaseName="simulation-history"
                csvRows={exportRows}
                jsonData={simulations}
                imageTargetRef={tableSectionRef}
              />
            ) : null}
            <Button variant="outline" onClick={() => void loadSimulations()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Simulations" value={stats.total.toString()} hint="Stored runs across all protocols" />
        <StatCard
          label="Average Compatibility"
          value={`${stats.avgCompatibility.toFixed(1)}%`}
          toneClassName={compatibilityTone(stats.avgCompatibility)}
        />
        <StatCard label="High Risk Patients" value={stats.highRisk.toString()} hint="Runs marked HIGH risk" />
        <StatCard label="Protocols Tested" value={stats.protocolCount.toString()} hint="Unique protocols with simulations" />
      </section>

      {simulations.length === 0 ? (
        <EmptyState
          icon={History}
          title="No simulations run yet"
          description="Screen patients against a protocol and run your first simulation."
          action={<Button onClick={() => router.push(ROUTES.PROTOCOLS)}>Browse Protocols</Button>}
        />
      ) : (
        <>
          <section
            ref={tableSectionRef}
            className="hidden overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 lg:block"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">Patient</th>
                    <th className="px-5 py-4">Protocol</th>
                    <th className="px-5 py-4">Compatibility</th>
                    <th className="px-5 py-4">Risk Level</th>
                    <th className="px-5 py-4">Criteria Evaluated</th>
                    <th className="px-5 py-4">Flagged</th>
                    <th className="px-5 py-4">Date Run</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((simulation) => (
                    <tr key={simulation.id} className="border-t border-border/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground">{simulation.patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          Age {simulation.patientAge} • {sexLabel(simulation.patientSex)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{simulation.protocolName}</td>
                      <td className={cn("px-5 py-4 font-semibold", compatibilityTone(simulation.compatibilityScore))}>
                        {simulation.compatibilityScore.toFixed(1)}%
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", riskBadgeTone(simulation.overallRisk))}>
                          {formatRiskLabel(simulation.overallRisk)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{simulation.evaluationCount}</td>
                      <td className="px-5 py-4 text-muted-foreground">{simulation.flaggedCount}</td>
                      <td className="px-5 py-4">
                        <p className="text-foreground">{formatRelativeTime(simulation.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(simulation.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <Button onClick={() => router.push(`${ROUTES.SIMULATION}/${simulation.id}`)}>View Results</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:hidden">
            {simulations.map((simulation) => (
              <article key={simulation.id} className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{simulation.patientName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Age {simulation.patientAge} • {sexLabel(simulation.patientSex)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{simulation.protocolName}</p>
                  </div>
                  <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", riskBadgeTone(simulation.overallRisk))}>
                    {formatRiskLabel(simulation.overallRisk)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-border/60 bg-background/35 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Compatibility</p>
                    <p className={cn("mt-2 text-lg font-semibold", compatibilityTone(simulation.compatibilityScore))}>
                      {simulation.compatibilityScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-border/60 bg-background/35 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date Run</p>
                    <p className="mt-2 text-sm text-foreground">{formatRelativeTime(simulation.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(simulation.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{simulation.evaluationCount} criteria evaluated</span>
                  <span>{simulation.flaggedCount} flagged</span>
                </div>
                <Button className="mt-4 w-full" onClick={() => router.push(`${ROUTES.SIMULATION}/${simulation.id}`)}>
                  View Results
                </Button>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
