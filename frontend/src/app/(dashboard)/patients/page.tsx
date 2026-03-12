"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  RefreshCcw,
  SearchSlash,
  UsersRound,
} from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { patientAPI, simulationAPI } from "@/lib/api";
import { cn, formatDate, formatRiskLabel } from "@/lib/utils";
import type { PatientProfile, PreScreenPatientResult } from "@/types/models";

interface PatientRow {
  summary: PreScreenPatientResult;
  details: PatientProfile | null;
}

function scoreTone(score: number | null): string {
  if (score === null) {
    return "bg-slate-500";
  }
  if (score >= 80) {
    return "bg-emerald-400";
  }
  if (score >= 50) {
    return "bg-amber-400";
  }
  return "bg-rose-400";
}

function riskBadgeTone(riskLevel: PatientProfile["riskLevel"] | PreScreenPatientResult["riskLevel"]): string {
  switch (riskLevel) {
    case "LOW":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "MEDIUM":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    case "HIGH":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-border/70 bg-muted/40 text-muted-foreground";
  }
}

function sexLabel(sex: "MALE" | "FEMALE"): string {
  return sex === "MALE" ? "Male" : "Female";
}

function buildRows(results: PreScreenPatientResult[], patients: PatientProfile[]): PatientRow[] {
  const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
  const rows = results.map((summary) => ({
    summary,
    details: patientMap.get(summary.id) ?? null,
  }));

  for (const patient of patients) {
    if (rows.some((row) => row.summary.id === patient.id)) {
      continue;
    }

    rows.push({
      summary: {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        primaryDiagnosis: patient.primaryDiagnosis,
        preScreenScore: patient.preScreenScore,
        riskLevel: patient.riskLevel,
        failReasons: patient.failReasons ?? [],
      },
      details: patient,
    });
  }

  return rows.sort((left, right) => (right.summary.preScreenScore ?? -1) - (left.summary.preScreenScore ?? -1));
}

function LoadingTable() {
  return (
    <div className="rounded-[2rem] border border-border/70 bg-card/50 p-4 md:p-6">
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid animate-pulse gap-4 rounded-[1.5rem] border border-border/60 bg-background/30 p-4 md:grid-cols-6"
          >
            <div className="h-5 rounded-full bg-muted/70 md:col-span-2" />
            <div className="h-5 rounded-full bg-muted/50" />
            <div className="h-5 rounded-full bg-muted/50" />
            <div className="h-5 rounded-full bg-muted/50" />
            <div className="h-5 rounded-full bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const protocolId = searchParams.get("protocol_id");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [runningSimulationId, setRunningSimulationId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!protocolId) {
      setRows([]);
      setError(null);
      setExpandedPatientId(null);
      return;
    }

    void loadPatients(protocolId);
  }, [protocolId]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function loadPatients(activeProtocolId: string) {
    setLoading(true);
    setError(null);
    try {
      const [preScreenResponse, patientResponse] = await Promise.all([
        simulationAPI.preScreen(activeProtocolId),
        patientAPI.list(activeProtocolId),
      ]);
      setRows(buildRows(preScreenResponse.data?.results ?? [], patientResponse.data ?? []));
    } catch (loadError) {
      console.error("Failed to screen patients", loadError);
      const message = loadError instanceof Error ? loadError.message : "Failed to screen patients.";
      setError(message);
      setToastMessage(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSimulation(patientId: string) {
    if (!protocolId) {
      return;
    }

    setRunningSimulationId(patientId);
    try {
      const response = await simulationAPI.runFull(protocolId, patientId);
      if (response.data) {
        router.push(`${ROUTES.SIMULATION}/${response.data.id}`);
      }
    } catch (runError) {
      console.error("Failed to run simulation", runError);
      setToastMessage(runError instanceof Error ? runError.message : "Failed to run simulation.");
    } finally {
      setRunningSimulationId(null);
    }
  }

  const titleDescription = useMemo(() => {
    if (!protocolId) {
      return "Select a confirmed protocol to run a bulk pre-screen across the seeded patient cohort.";
    }
    return "Screening patients against protocol criteria, ranking the strongest candidates first, and exposing quick blockers before full digital twin simulation.";
  }, [protocolId]);

  if (!protocolId) {
    return (
      <div className="space-y-8">
        <PageHeader title="Patients" description={titleDescription} />
        <EmptyState
          icon={SearchSlash}
          title="Select a protocol first"
          description="Patient screening is protocol-specific. Confirm a protocol, then open the patient cohort from that protocol's review page."
          action={<Button onClick={() => router.push(ROUTES.PROTOCOLS)}>Browse Protocols</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Patients"
        description={titleDescription}
        action={
          <Button variant="outline" onClick={() => void loadPatients(protocolId)} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Refreshing..." : "Re-screen"}
          </Button>
        }
      />

      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-rose-400/30 bg-slate-950/95 px-4 py-3 text-sm text-rose-100 shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      {loading ? (
        <>
          <section className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Pre-Screen Sweep</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">
              Screening patients against protocol criteria...
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Current values are being evaluated first so the cohort can be ranked before any full simulations run.
            </p>
          </section>
          <LoadingTable />
        </>
      ) : error ? (
        <section className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Patient screening failed</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button onClick={() => void loadPatients(protocolId)}>Retry</Button>
        </section>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No patients in the database"
          description="The pre-screen returned no patient records. Seed or upload patient data, then rerun the cohort sweep for this protocol."
          action={
            <Button variant="outline" onClick={() => void loadPatients(protocolId)}>
              <RefreshCcw className="h-4 w-4" />
              Retry Screening
            </Button>
          }
        />
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">Patient</th>
                    <th className="px-5 py-4">Primary Diagnosis</th>
                    <th className="px-5 py-4">Pre-Screen Score</th>
                    <th className="px-5 py-4">Risk Level</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((row) => {
                    const expanded = expandedPatientId === row.summary.id;

                    return [
                      <tr
                        key={row.summary.id}
                        className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                        onClick={() => setExpandedPatientId(expanded ? null : row.summary.id)}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{row.summary.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Age {row.summary.age} • {sexLabel(row.summary.sex)}
                              </p>
                            </div>
                            {expanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{row.summary.primaryDiagnosis}</td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted/70">
                              <div
                                className={cn("h-full rounded-full", scoreTone(row.summary.preScreenScore))}
                                style={{ width: `${row.summary.preScreenScore ?? 0}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {row.summary.preScreenScore?.toFixed(1) ?? "0.0"}%
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                              riskBadgeTone(row.summary.riskLevel),
                            )}
                          >
                            {formatRiskLabel(row.summary.riskLevel)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {row.summary.failReasons.length > 0 ? (
                            <div className="space-y-1">
                              {row.summary.failReasons.slice(0, 2).map((reason) => (
                                <p key={reason} className="max-w-md text-xs text-muted-foreground">
                                  {reason}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-emerald-200">No blocking criteria at pre-screen.</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end">
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRunSimulation(row.summary.id);
                              }}
                              disabled={runningSimulationId === row.summary.id}
                            >
                              <FlaskConical className="h-4 w-4" />
                              {runningSimulationId === row.summary.id ? "Running..." : "Run Simulation"}
                            </Button>
                          </div>
                        </td>
                      </tr>,
                      expanded ? (
                        <tr key={`${row.summary.id}-expanded`} className="border-t border-border/30 bg-background/35">
                          <td colSpan={6} className="px-5 py-5">
                            <ExpandedPatientPanel patient={row.details} failReasons={row.summary.failReasons} />
                          </td>
                        </tr>
                      ) : null,
                    ].filter(Boolean);
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:hidden">
            {rows.map((row) => {
              const expanded = expandedPatientId === row.summary.id;
              return (
                <article key={row.summary.id} className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 text-left"
                    onClick={() => setExpandedPatientId(expanded ? null : row.summary.id)}
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{row.summary.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Age {row.summary.age} • {sexLabel(row.summary.sex)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{row.summary.primaryDiagnosis}</p>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <span>Pre-Screen Score</span>
                        <span>{row.summary.preScreenScore?.toFixed(1) ?? "0.0"}%</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted/70">
                        <div
                          className={cn("h-full rounded-full", scoreTone(row.summary.preScreenScore))}
                          style={{ width: `${row.summary.preScreenScore ?? 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                          riskBadgeTone(row.summary.riskLevel),
                        )}
                      >
                        {formatRiskLabel(row.summary.riskLevel)}
                      </span>
                      <Button
                        onClick={() => void handleRunSimulation(row.summary.id)}
                        disabled={runningSimulationId === row.summary.id}
                      >
                        {runningSimulationId === row.summary.id ? "Running..." : "Run Simulation"}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {row.summary.failReasons.length > 0 ? (
                        row.summary.failReasons.slice(0, 2).map((reason) => (
                          <p key={reason} className="text-xs text-muted-foreground">
                            {reason}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-emerald-200">No blocking criteria at pre-screen.</p>
                      )}
                    </div>
                    {expanded ? <ExpandedPatientPanel patient={row.details} failReasons={row.summary.failReasons} /> : null}
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

function ExpandedPatientPanel({
  patient,
  failReasons,
}: {
  patient: PatientProfile | null;
  failReasons: string[];
}) {
  if (!patient) {
    return (
      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        Detailed patient profile data is not available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Latest Labs</p>
        <div className="mt-3 space-y-2">
          {patient.labResults.length > 0 ? (
            patient.labResults.map((lab) => (
              <div key={`${lab.parameter}-${lab.date}`} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{lab.parameter}</p>
                  <p className="text-xs text-muted-foreground">Updated {formatDate(lab.date)}</p>
                </div>
                <p className="text-right text-muted-foreground">
                  {lab.value} {lab.unit}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No lab history available.</p>
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Conditions</p>
        <div className="mt-3 space-y-2">
          {patient.conditions.length > 0 ? (
            patient.conditions.map((condition) => (
              <div key={`${condition.icdCode}-${condition.onsetDate}`} className="text-sm">
                <p className="font-medium text-foreground">{condition.name}</p>
                <p className="text-xs text-muted-foreground">
                  {condition.icdCode} • onset {formatDate(condition.onsetDate)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No condition records available.</p>
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Medications</p>
        <div className="mt-3 space-y-2">
          {patient.medications.length > 0 ? (
            patient.medications.map((medication) => (
              <div key={`${medication.name}-${medication.startDate}`} className="text-sm">
                <p className="font-medium text-foreground">{medication.name}</p>
                <p className="text-xs text-muted-foreground">
                  {medication.dose} • {medication.frequency}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(medication.startDate)}
                  {medication.endDate ? ` to ${formatDate(medication.endDate)}` : " to present"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No medication records available.</p>
          )}
        </div>
        {failReasons.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Fail Reasons</p>
            <div className="mt-2 space-y-1">
              {failReasons.map((reason) => (
                <p key={reason} className="text-xs text-muted-foreground">
                  {reason}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
