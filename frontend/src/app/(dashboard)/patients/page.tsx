"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  RefreshCcw,
  Search,
  SearchSlash,
  UsersRound,
} from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ExportMenu } from "@/components/common/ExportMenu";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { patientAPI, protocolAPI, simulationAPI } from "@/lib/api";
import { cn, formatDate, formatRelativeTime, formatRiskLabel } from "@/lib/utils";
import type { PatientProfile, PreScreenPatientResult, Protocol, SimulationListItem } from "@/types/models";

interface PatientRow {
  summary: PreScreenPatientResult;
  details: PatientProfile | null;
}

function scoreTone(score: number | null): string {
  if (score === null) return "bg-slate-500";
  if (score >= 80) return "bg-emerald-400";
  if (score >= 50) return "bg-amber-400";
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
    if (rows.some((row) => row.summary.id === patient.id)) continue;
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

function buildCachedRows(patients: PatientProfile[]): PatientRow[] {
  return buildRows(
    patients.map((patient) => ({
      id: patient.id,
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      primaryDiagnosis: patient.primaryDiagnosis,
      preScreenScore: patient.preScreenScore,
      riskLevel: patient.riskLevel,
      failReasons: patient.failReasons ?? [],
    })),
    patients,
  );
}

function latestLab(patient: PatientProfile, parameter: string) {
  return patient.labResults.find((lab) => lab.parameter.toLowerCase() === parameter.toLowerCase()) ?? null;
}

function labStatusTone(value: number, referenceRange: [number, number]) {
  const [low, high] = referenceRange;
  if (value < low || value > high) {
    return {
      dot: "bg-rose-400",
      text: "text-rose-200",
      label: "Abnormal",
    };
  }

  return {
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    label: "Within range",
  };
}

function formatPrimaryConditions(patients: PatientProfile[]): string {
  const counts = new Map<string, number>();
  for (const patient of patients) {
    const key = patient.primaryDiagnosis.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);

  if (top.length === 0) return "No diagnoses available";
  return top.map(([name, count]) => `${name}: ${count}`).join(", ");
}

function confirmedProtocols(protocols: Protocol[]): Protocol[] {
  return protocols.filter((protocol) => protocol.status === "CONFIRMED");
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

function StatCard({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <article className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}

function ScreeningExpandedPanel({
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

function RegistryExpandedPanel({
  patient,
  protocols,
  selectedProtocolId,
  onSelectProtocol,
  onRunSimulation,
  running,
}: {
  patient: PatientProfile;
  protocols: Protocol[];
  selectedProtocolId: string;
  onSelectProtocol: (value: string) => void;
  onRunSimulation: () => void;
  running: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Latest Labs</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {patient.labResults.length > 0 ? (
            patient.labResults.map((lab) => {
              const tone = labStatusTone(lab.value, lab.referenceRange);
              return (
                <div key={`${lab.parameter}-${lab.date}`} className="rounded-[1.25rem] border border-border/50 bg-background/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{lab.parameter}</p>
                    <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} />
                  </div>
                  <p className={cn("mt-2 text-sm font-medium", tone.text)}>
                    {lab.value} {lab.unit}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ref {lab.referenceRange[0]}-{lab.referenceRange[1]} {lab.unit}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(lab.date)}</p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No lab history available.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Active Medications</p>
          <div className="mt-3 space-y-2">
            {patient.medications.length > 0 ? (
              patient.medications.map((medication) => (
                <div key={`${medication.name}-${medication.startDate}`} className="rounded-[1.1rem] bg-background/30 p-3 text-sm">
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
              <p className="text-sm text-muted-foreground">No active medications recorded.</p>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Conditions</p>
          <div className="mt-3 space-y-2">
            {patient.conditions.length > 0 ? (
              patient.conditions.map((condition) => (
                <div key={`${condition.icdCode}-${condition.onsetDate}`} className="rounded-[1.1rem] bg-background/30 p-3 text-sm">
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
      </div>

      <div className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Run Simulation</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Choose a confirmed protocol and run a full eligibility simulation for this patient.
        </p>
        <select
          value={selectedProtocolId}
          onChange={(event) => onSelectProtocol(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40"
        >
          <option value="">Select confirmed protocol</option>
          {protocols.map((protocol) => (
            <option key={protocol.id} value={protocol.id}>
              {protocol.name}
            </option>
          ))}
        </select>
        <Button className="mt-4 w-full" onClick={onRunSimulation} disabled={!selectedProtocolId || running}>
          <FlaskConical className="h-4 w-4" />
          {running ? "Running... Generating reasoning traces..." : "Run Simulation"}
        </Button>
      </div>
    </div>
  );
}

function ProtocolScreeningMode({ protocolId }: { protocolId: string }) {
  const router = useRouter();
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [runningSimulationId, setRunningSimulationId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadPatients(protocolId);
  }, [protocolId]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function loadPatients(activeProtocolId: string) {
    setLoading(true);
    setError(null);
    try {
      const patientResponse = await patientAPI.list(activeProtocolId);
      const patients = patientResponse.data ?? [];
      const hasCachedScores = patients.length > 0 && patients.every((patient) => patient.preScreenScore !== null);

      if (hasCachedScores) {
        setRows(buildCachedRows(patients));
        return;
      }

      const preScreenResponse = await simulationAPI.preScreen(activeProtocolId);
      setRows(buildRows(preScreenResponse.data?.results ?? [], patients));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to screen patients.";
      setError(message);
      setToastMessage(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSimulation(patientId: string) {
    setRunningSimulationId(patientId);
    try {
      const response = await simulationAPI.runFull(protocolId, patientId);
      if (response.data) router.push(`${ROUTES.SIMULATION}/${response.data.id}`);
    } catch (runError) {
      setToastMessage(runError instanceof Error ? runError.message : "Failed to run simulation.");
    } finally {
      setRunningSimulationId(null);
    }
  }

  const patientExportRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.summary.id,
        name: row.summary.name,
        age: row.summary.age,
        sex: row.summary.sex,
        primaryDiagnosis: row.summary.primaryDiagnosis,
        preScreenScore: row.summary.preScreenScore,
        riskLevel: row.summary.riskLevel,
        failReasons: row.summary.failReasons.join("; "),
      })),
    [rows],
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Patients"
          description="Screening patients against protocol criteria, ranking the strongest candidates first, and exposing quick blockers before full digital twin simulation."
        />
        <section className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/5 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Pre-Screen Sweep</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Screening patients against protocol criteria...</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Current values are being evaluated first so the cohort can be ranked before any full simulations run.
          </p>
        </section>
        <LoadingTable />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Patients"
        description="Screening patients against protocol criteria, ranking the strongest candidates first, and exposing quick blockers before full digital twin simulation."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {rows.length > 0 ? (
              <ExportMenu
                fileBaseName={`protocol-${protocolId}-patient-screening`}
                csvRows={patientExportRows}
                jsonData={rows.map((row) => row.summary)}
                imageTargetRef={tableSectionRef}
              />
            ) : null}
            <Button variant="outline" onClick={() => void loadPatients(protocolId)}>
              <RefreshCcw className="h-4 w-4" />
              Re-screen
            </Button>
          </div>
        }
      />

      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-rose-400/30 bg-slate-950/95 px-4 py-3 text-sm text-rose-100 shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      {error ? (
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
          <section
            ref={tableSectionRef}
            className="hidden overflow-hidden rounded-[2rem] border border-border/70 bg-card/60 lg:block"
          >
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
                            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
                          <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", riskBadgeTone(row.summary.riskLevel))}>
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
                              {runningSimulationId === row.summary.id
                                ? "Running... Generating reasoning traces..."
                                : "Run Simulation"}
                            </Button>
                          </div>
                        </td>
                      </tr>,
                      expanded ? (
                        <tr key={`${row.summary.id}-expanded`} className="border-t border-border/30 bg-background/35">
                          <td colSpan={6} className="px-5 py-5">
                            <ScreeningExpandedPanel patient={row.details} failReasons={row.summary.failReasons} />
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
                    {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
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
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", riskBadgeTone(row.summary.riskLevel))}>
                        {formatRiskLabel(row.summary.riskLevel)}
                      </span>
                      <Button onClick={() => void handleRunSimulation(row.summary.id)} disabled={runningSimulationId === row.summary.id}>
                        {runningSimulationId === row.summary.id ? "Running... Generating reasoning traces..." : "Run Simulation"}
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
                    {expanded ? <ScreeningExpandedPanel patient={row.details} failReasons={row.summary.failReasons} /> : null}
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

function PatientRegistryMode() {
  const router = useRouter();
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [simulations, setSimulations] = useState<SimulationListItem[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [runningSimulationId, setRunningSimulationId] = useState<string | null>(null);
  const [patientProtocolSelections, setPatientProtocolSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadRegistry();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  async function loadRegistry() {
    setLoading(true);
    setError(null);
    try {
      const [patientResponse, protocolResponse, simulationResponse] = await Promise.all([
        patientAPI.list(),
        protocolAPI.list(),
        simulationAPI.list(),
      ]);

      const patientData = patientResponse.data ?? [];
      const protocolData = protocolResponse.data ?? [];
      const confirmed = confirmedProtocols(protocolData);

      setPatients(patientData);
      setProtocols(protocolData);
      setSimulations(simulationResponse.data ?? []);
      setSelectedProtocolId((current) => current || confirmed[0]?.id || "");
      setPatientProtocolSelections((current) => {
        if (Object.keys(current).length > 0) return current;
        const fallback = confirmed[0]?.id ?? "";
        return patientData.reduce<Record<string, string>>((accumulator, patient) => {
          if (fallback) accumulator[patient.id] = fallback;
          return accumulator;
        }, {});
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load patient registry.";
      setError(message);
      setToastMessage(message);
      setPatients([]);
      setProtocols([]);
      setSimulations([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSimulation(patientId: string, protocolId: string) {
    if (!protocolId) {
      setToastMessage("Select a confirmed protocol before running a simulation.");
      return;
    }

    setRunningSimulationId(patientId);
    try {
      const response = await simulationAPI.runFull(protocolId, patientId);
      if (response.data) router.push(`${ROUTES.SIMULATION}/${response.data.id}`);
    } catch (runError) {
      setToastMessage(runError instanceof Error ? runError.message : "Failed to run simulation.");
    } finally {
      setRunningSimulationId(null);
    }
  }

  const confirmed = useMemo(() => confirmedProtocols(protocols), [protocols]);
  const filteredPatients = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(query) || patient.primaryDiagnosis.toLowerCase().includes(query),
    );
  }, [patients, searchValue]);

  const averageAge = useMemo(() => {
    if (patients.length === 0) return 0;
    return patients.reduce((total, patient) => total + patient.age, 0) / patients.length;
  }, [patients]);

  const registryExportRows = useMemo(
    () =>
      filteredPatients.map((patient) => {
        const egfr = latestLab(patient, "egfr");
        const hba1c = latestLab(patient, "hba1c");
        return {
          id: patient.id,
          name: patient.name,
          age: patient.age,
          sex: patient.sex,
          primaryDiagnosis: patient.primaryDiagnosis,
          egfr: egfr ? `${egfr.value} ${egfr.unit}` : "N/A",
          hba1c: hba1c ? `${hba1c.value} ${hba1c.unit}` : "N/A",
          medicationCount: patient.medications.length,
          conditionCount: patient.conditions.length,
        };
      }),
    [filteredPatients],
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Patient Registry"
          description="Browse all patients in the database. Select a protocol to run eligibility screening."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-[1.75rem] border border-border/70 bg-card/50" />
          ))}
        </div>
        <LoadingTable />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Patient Registry"
          description="Browse all patients in the database. Select a protocol to run eligibility screening."
        />
        <section className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Patient registry failed to load</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button onClick={() => void loadRegistry()}>Retry</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Patient Registry"
        description="Browse all patients in the database. Select a protocol to run eligibility screening."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => setPickerOpen((current) => !current)}>
              Screen Against Protocol
            </Button>
            <Button variant="outline" onClick={() => void loadRegistry()}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-rose-400/30 bg-slate-950/95 px-4 py-3 text-sm text-rose-100 shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      {pickerOpen ? (
        <section className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Quick Action</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">Run cohort pre-screen</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a confirmed protocol to open screening mode and rank the full patient cohort.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <select
                value={selectedProtocolId}
                onChange={(event) => setSelectedProtocolId(event.target.value)}
                className="min-w-[18rem] rounded-2xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition focus:border-cyan-300/40"
              >
                <option value="">Select confirmed protocol</option>
                {confirmed.map((protocol) => (
                  <option key={protocol.id} value={protocol.id}>
                    {protocol.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => router.push(`${ROUTES.PATIENTS}?protocol_id=${selectedProtocolId}`)}
                disabled={!selectedProtocolId}
              >
                Screen Patients
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Patients" value={patients.length.toString()} hint="Patients available for screening" />
        <StatCard label="Average Age" value={patients.length ? `${averageAge.toFixed(1)} years` : "0 years"} />
        <StatCard label="Primary Conditions" value={formatPrimaryConditions(patients)} hint="Most common diagnoses" />
        <StatCard
          label="Recent Simulations"
          value={simulations.length.toString()}
          hint="Full simulations already run"
          action={
            <Button variant="outline" onClick={() => router.push(ROUTES.SIMULATION)}>
              View History
            </Button>
          }
        />
      </section>

      {patients.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No patients available"
          description="The database does not contain any patients yet. Add patient data, then return here to browse and run simulations."
          action={
            <Button variant="outline" onClick={() => void loadRegistry()}>
              <RefreshCcw className="h-4 w-4" />
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <section className="rounded-[2rem] border border-border/70 bg-card/60 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search patients by name or diagnosis"
                  className="w-full rounded-2xl border border-border/70 bg-background/50 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-cyan-300/40"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  {filteredPatients.length} of {patients.length} patients shown
                </p>
                <ExportMenu
                  fileBaseName="patient-registry"
                  csvRows={registryExportRows}
                  jsonData={filteredPatients}
                  imageTargetRef={tableSectionRef}
                />
              </div>
            </div>
          </section>

          {filteredPatients.length === 0 ? (
            <EmptyState
              icon={SearchSlash}
              title="No patients match this search"
              description="Try a patient name or diagnosis term already present in the registry."
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
                        <th className="px-5 py-4">Primary Diagnosis</th>
                        <th className="px-5 py-4">Latest eGFR</th>
                        <th className="px-5 py-4">Latest HbA1c</th>
                        <th className="px-5 py-4">Active Medications</th>
                        <th className="px-5 py-4">Conditions</th>
                        <th className="px-5 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.flatMap((patient) => {
                        const expanded = expandedPatientId === patient.id;
                        const egfr = latestLab(patient, "egfr");
                        const hba1c = latestLab(patient, "hba1c");
                        const egfrTone = egfr ? labStatusTone(egfr.value, egfr.referenceRange) : null;
                        const hba1cTone = hba1c ? labStatusTone(hba1c.value, hba1c.referenceRange) : null;
                        const selectedPerPatient = patientProtocolSelections[patient.id] ?? "";

                        return [
                          <tr
                            key={patient.id}
                            className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/20"
                            onClick={() => setExpandedPatientId(expanded ? null : patient.id)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-foreground">{patient.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Age {patient.age} • {sexLabel(patient.sex)}
                                  </p>
                                </div>
                                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{patient.primaryDiagnosis}</td>
                            <td className="px-5 py-4">
                              {egfr ? (
                                <div>
                                  <p className={cn("font-medium", egfrTone?.text)}>
                                    {egfr.value} {egfr.unit}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{egfrTone?.label}</p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No data</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {hba1c ? (
                                <div>
                                  <p className={cn("font-medium", hba1cTone?.text)}>
                                    {hba1c.value} {hba1c.unit}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{hba1cTone?.label}</p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No data</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{patient.medications.length} active</td>
                            <td className="px-5 py-4 text-muted-foreground">{patient.conditions.length}</td>
                            <td className="px-5 py-4">
                              <Button
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedPatientId(expanded ? null : patient.id);
                                }}
                              >
                                {expanded ? "Hide Details" : "View Details"}
                              </Button>
                            </td>
                          </tr>,
                          expanded ? (
                            <tr key={`${patient.id}-expanded`} className="border-t border-border/30 bg-background/35">
                              <td colSpan={7} className="px-5 py-5">
                                <RegistryExpandedPanel
                                  patient={patient}
                                  protocols={confirmed}
                                  selectedProtocolId={selectedPerPatient}
                                  onSelectProtocol={(value) =>
                                    setPatientProtocolSelections((current) => ({ ...current, [patient.id]: value }))
                                  }
                                  onRunSimulation={() => void handleRunSimulation(patient.id, selectedPerPatient)}
                                  running={runningSimulationId === patient.id}
                                />
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
                {filteredPatients.map((patient) => {
                  const expanded = expandedPatientId === patient.id;
                  const egfr = latestLab(patient, "egfr");
                  const hba1c = latestLab(patient, "hba1c");
                  const selectedPerPatient = patientProtocolSelections[patient.id] ?? "";
                  return (
                    <article key={patient.id} className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-4 text-left"
                        onClick={() => setExpandedPatientId(expanded ? null : patient.id)}
                      >
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">{patient.name}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Age {patient.age} • {sexLabel(patient.sex)}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">{patient.primaryDiagnosis}</p>
                        </div>
                        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.25rem] border border-border/60 bg-background/35 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest eGFR</p>
                          <p className="mt-2 text-sm text-foreground">{egfr ? `${egfr.value} ${egfr.unit}` : "No data"}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/60 bg-background/35 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest HbA1c</p>
                          <p className="mt-2 text-sm text-foreground">{hba1c ? `${hba1c.value} ${hba1c.unit}` : "No data"}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                        <span>{patient.medications.length} active medications</span>
                        <span>{patient.conditions.length} conditions</span>
                      </div>
                      {expanded ? (
                        <div className="mt-4">
                          <RegistryExpandedPanel
                            patient={patient}
                            protocols={confirmed}
                            selectedProtocolId={selectedPerPatient}
                            onSelectProtocol={(value) =>
                              setPatientProtocolSelections((current) => ({ ...current, [patient.id]: value }))
                            }
                            onRunSimulation={() => void handleRunSimulation(patient.id, selectedPerPatient)}
                            running={runningSimulationId === patient.id}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}

      <section className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-cyan-300" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Registry note</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Use the quick action above to pre-screen the full cohort against a confirmed protocol, or expand an
              individual patient row to run a one-off full simulation directly from the registry.
            </p>
            {simulations[0] ? (
              <p className="text-xs text-muted-foreground">
                Latest simulation: {simulations[0].patientName} on {simulations[0].protocolName} •{" "}
                {formatRelativeTime(simulations[0].createdAt)}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PatientsPage() {
  const searchParams = useSearchParams();
  const protocolId = searchParams.get("protocol_id");
  return protocolId ? <ProtocolScreeningMode protocolId={protocolId} /> : <PatientRegistryMode />;
}
