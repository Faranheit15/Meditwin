"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Microscope,
  Radar,
  RefreshCcw,
} from "lucide-react";
import {
  CartesianGrid,
  DotProps,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/common/EmptyState";
import { ExportMenu } from "@/components/common/ExportMenu";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { patientAPI, protocolAPI, simulationAPI } from "@/lib/api";
import { cn, formatDate, formatRiskLabel } from "@/lib/utils";
import type {
  EvaluationResponse,
  PatientProfile,
  ProtocolWithCriteria,
  SimulationResponse,
} from "@/types/models";

const STATUS_COLORS = {
  PASS: { bg: "bg-emerald-500", text: "text-emerald-300", ring: "ring-emerald-400/35", label: "Pass" },
  BORDERLINE: { bg: "bg-amber-500", text: "text-amber-200", ring: "ring-amber-400/35", label: "Borderline" },
  FAIL: { bg: "bg-red-500", text: "text-rose-200", ring: "ring-rose-400/35", label: "Fail" },
} as const;

const OPERATOR_DISPLAY: Record<string, string> = {
  GTE: ">=",
  LTE: "<=",
  EQ: "=",
  NEQ: "!=",
  BOOLEAN: "Has/Doesn't Have",
  NOT_WITHIN: "Not Within",
  STABLE: "Stable",
};

interface GridRow {
  key: string;
  label: string;
  parameter: string;
  category: EvaluationResponse["category"];
  cells: Map<number, EvaluationResponse>;
}

interface ParameterChartPoint {
  week: number;
  value: number;
  threshold: number | null;
  status: EvaluationResponse["status"];
}

interface ParameterChart {
  parameter: string;
  unit: string | null;
  trendLabel: string;
  points: ParameterChartPoint[];
}

function riskBadgeTone(risk: SimulationResponse["overallRisk"] | PatientProfile["riskLevel"]) {
  switch (risk) {
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

function findingBadgeTone(status: EvaluationResponse["status"]) {
  switch (status) {
    case "BORDERLINE":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    case "FAIL":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
}

function compatibilityTone(score: number): string {
  if (score >= 80) {
    return "text-emerald-300";
  }
  if (score >= 50) {
    return "text-amber-200";
  }
  return "text-rose-200";
}

function weekLabel(week: number): string {
  return week === 0 ? "Screening" : `Wk ${week}`;
}

function sexLabel(sex: PatientProfile["sex"] | undefined): string {
  if (!sex) {
    return "Unknown";
  }
  return sex === "MALE" ? "Male" : "Female";
}

function tooltipText(evaluation: EvaluationResponse): string {
  return [
    `${evaluation.status} • ${evaluation.parameter} ${OPERATOR_DISPLAY[evaluation.operator] ?? evaluation.operator} ${evaluation.threshold ?? "-"}`,
    `Projected value: ${evaluation.projectedValue ?? "N/A"}`,
    `Margin: ${evaluation.marginPercent.toFixed(1)}%`,
    `Confidence: ${(evaluation.confidence * 100).toFixed(0)}%`,
  ].join("\n");
}

function parameterUnit(parameter: string, protocol: ProtocolWithCriteria | null): string | null {
  return protocol?.criteria.find((criterion) => criterion.parameter === parameter && criterion.unit)?.unit ?? null;
}

function getParameterChartData(evaluations: EvaluationResponse[], parameter: string): ParameterChartPoint[] {
  const seenWeeks = new Set<number>();
  return evaluations
    .filter((evaluation) => evaluation.parameter === parameter && evaluation.projectedValue !== null)
    .sort((left, right) => {
      if (left.week !== right.week) {
        return left.week - right.week;
      }
      if (left.category === right.category) {
        return 0;
      }
      return left.category === "INCLUSION" ? -1 : 1;
    })
    .filter((evaluation) => {
      if (seenWeeks.has(evaluation.week)) {
        return false;
      }
      seenWeeks.add(evaluation.week);
      return true;
    })
    .map((evaluation) => ({
      week: evaluation.week,
      value: evaluation.projectedValue ?? 0,
      threshold: evaluation.threshold,
      status: evaluation.status,
    }));
}

function trendDescription(points: ParameterChartPoint[]): string {
  if (points.length < 2) {
    return "Single projection point";
  }

  const first = points[0];
  const last = points[points.length - 1];
  const totalWeeks = Math.max(1, last.week - first.week);
  const monthlySlope = ((last.value - first.value) / totalWeeks) * 4;

  if (Math.abs(monthlySlope) < 0.1) {
    return "Stable";
  }

  const direction = monthlySlope > 0 ? "Rising" : "Declining";
  return `${direction} at ${Math.abs(monthlySlope).toFixed(1)}/month`;
}

function chartTooltipValue(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function StatusDot(props: DotProps & { payload?: ParameterChartPoint }) {
  const { cx, cy, payload } = props;
  if (typeof cx !== "number" || typeof cy !== "number" || !payload) {
    return null;
  }

  const color =
    payload.status === "FAIL" ? "#ef4444" : payload.status === "BORDERLINE" ? "#f59e0b" : "#10b981";
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

export default function SimulationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const simulationId = params.id;
  const timelineSectionRef = useRef<HTMLElement | null>(null);
  const reasoningSectionRef = useRef<HTMLElement | null>(null);
  const chartsSectionRef = useRef<HTMLElement | null>(null);
  const reasoningRefs = useRef<Record<string, HTMLElement | null>>({});
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [protocol, setProtocol] = useState<ProtocolWithCriteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [runningAgain, setRunningAgain] = useState(false);

  useEffect(() => {
    if (!simulationId) {
      return;
    }
    void loadSimulation(simulationId);
  }, [simulationId]);

  async function loadSimulation(activeSimulationId: string) {
    setLoading(true);
    setError(null);
    try {
      const simulationResponse = await simulationAPI.getResult(activeSimulationId);
      const simulationData = simulationResponse.data;
      if (!simulationData) {
        throw new Error("Simulation result was empty.");
      }

      setSimulation(simulationData);

      const [patientResult, protocolResult] = await Promise.allSettled([
        patientAPI.getById(simulationData.patientId),
        protocolAPI.getById(simulationData.protocolId),
      ]);

      setPatient(patientResult.status === "fulfilled" ? patientResult.value.data : null);
      setProtocol(protocolResult.status === "fulfilled" ? protocolResult.value.data : null);
    } catch (loadError) {
      console.error("Failed to load simulation", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load simulation.");
      setSimulation(null);
      setPatient(null);
      setProtocol(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunAgain() {
    if (!simulation) {
      return;
    }

    setRunningAgain(true);
    try {
      const response = await simulationAPI.runFull(simulation.protocolId, simulation.patientId);
      if (response.data) {
        router.push(`${ROUTES.SIMULATION}/${response.data.id}`);
      }
    } catch (runError) {
      console.error("Failed to rerun simulation", runError);
      setError(runError instanceof Error ? runError.message : "Failed to rerun simulation.");
    } finally {
      setRunningAgain(false);
    }
  }

  const weeks = useMemo(() => {
    if (!simulation) {
      return [];
    }
    return [...new Set(simulation.evaluations.map((evaluation) => evaluation.week))].sort((left, right) => left - right);
  }, [simulation]);

  const gridRows = useMemo(() => {
    if (!simulation) {
      return [];
    }

    const grouped = new Map<string, GridRow>();
    for (const evaluation of simulation.evaluations) {
      const key = `${evaluation.parameter}_${evaluation.category}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.cells.set(evaluation.week, evaluation);
        continue;
      }

      grouped.set(key, {
        key,
        label: evaluation.criterionText,
        parameter: evaluation.parameter,
        category: evaluation.category,
        cells: new Map([[evaluation.week, evaluation]]),
      });
    }

    return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [simulation]);

  const flaggedByWeek = useMemo(() => {
    if (!simulation) {
      return [];
    }

    const groups = new Map<number, EvaluationResponse[]>();
    for (const evaluation of simulation.evaluations) {
      if (evaluation.status === "PASS") {
        continue;
      }
      const current = groups.get(evaluation.week) ?? [];
      current.push(evaluation);
      groups.set(evaluation.week, current);
    }

    return [...groups.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([week, evaluations]) => ({
        week,
        evaluations: evaluations.sort((left, right) => left.criterionText.localeCompare(right.criterionText)),
      }));
  }, [simulation]);

  const timelineExportRows = useMemo(
    () =>
      simulation?.evaluations.map((evaluation) => ({
        evaluationId: evaluation.id,
        week: evaluation.week,
        criterionText: evaluation.criterionText,
        category: evaluation.category,
        parameter: evaluation.parameter,
        operator: evaluation.operator,
        status: evaluation.status,
        projectedValue: evaluation.projectedValue,
        threshold: evaluation.threshold,
        marginPercent: evaluation.marginPercent,
        confidence: evaluation.confidence,
      })) ?? [],
    [simulation],
  );

  const reasoningExportRows = useMemo(
    () =>
      simulation?.evaluations
        .filter((evaluation) => evaluation.reasoning)
        .map((evaluation) => ({
          evaluationId: evaluation.id,
          week: evaluation.week,
          criterionText: evaluation.criterionText,
          status: evaluation.status,
          parameter: evaluation.parameter,
          projectedValue: evaluation.projectedValue,
          threshold: evaluation.threshold,
          explanation: evaluation.reasoning?.explanation ?? "",
          riskFactors: evaluation.reasoning?.riskFactors.join("; ") ?? "",
          suggestion: evaluation.reasoning?.suggestion ?? "",
          confidenceNote: evaluation.reasoning?.confidenceNote ?? "",
        })) ?? [],
    [simulation],
  );

  const parameterCharts = useMemo(() => {
    if (!simulation) {
      return [];
    }

    const parameters = [...new Set(simulation.evaluations.map((evaluation) => evaluation.parameter))];
    return parameters
      .map((parameter) => {
        const points = getParameterChartData(simulation.evaluations, parameter);
        return {
          parameter,
          unit: parameterUnit(parameter, protocol),
          trendLabel: trendDescription(points),
          points,
        } satisfies ParameterChart;
      })
      .filter((chart) => chart.points.length >= 2)
      .slice(0, 6);
  }, [protocol, simulation]);

  const parameterChartExportRows = useMemo(
    () =>
      parameterCharts.flatMap((chart) =>
        chart.points.map((point) => ({
          parameter: chart.parameter,
          unit: chart.unit,
          trendLabel: chart.trendLabel,
          week: point.week,
          projectedValue: point.value,
          threshold: point.threshold,
          status: point.status,
        })),
      ),
    [parameterCharts],
  );

  function handleSelectEvaluation(evaluation: EvaluationResponse) {
    if (evaluation.status === "PASS") {
      return;
    }

    setSelectedEvaluationId(evaluation.id);
    reasoningRefs.current[evaluation.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-border/70 bg-card/50 p-8">
        <LoadingSpinner label="Loading simulation results and reasoning traces..." />
      </div>
    );
  }

  if (error || !simulation) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Simulation Results"
          description="Review stored simulation runs, projected eligibility changes, and reasoning traces for flagged findings."
        />
        <section className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-300" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Simulation could not be loaded</h2>
              <p className="text-sm text-muted-foreground">{error ?? "Unknown simulation error."}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => router.push(ROUTES.PATIENTS)}>
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
            <Button onClick={() => void loadSimulation(simulationId)}>Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Simulation Results"
        description="Projected eligibility across the trial timeline, with reasoning traces for the criteria most likely to block enrollment."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => router.push(`${ROUTES.PATIENTS}?protocol_id=${simulation.protocolId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
            <Button onClick={() => void handleRunAgain()} disabled={runningAgain}>
              <RefreshCcw className="h-4 w-4" />
              {runningAgain ? "Running simulation... Generating reasoning traces..." : "Run Again"}
            </Button>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Patient Twin Summary</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div>
                <h2 className="text-3xl font-semibold text-foreground">{patient?.name ?? "Patient"}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Age {patient?.age ?? "Unknown"} • {sexLabel(patient?.sex)} • {patient?.primaryDiagnosis ?? "Diagnosis unavailable"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 px-3 py-1">
                  Protocol: {protocol?.name ?? simulation.protocolId}
                </span>
                <span className="rounded-full border border-border/70 px-3 py-1">
                  Simulation date: {formatDate(simulation.createdAt)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/35 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Compatibility</p>
                <p className={cn("mt-2 text-4xl font-semibold", compatibilityTone(simulation.compatibilityScore))}>
                  {simulation.compatibilityScore.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/35 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overall Risk</p>
                <div className="mt-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                      riskBadgeTone(simulation.overallRisk),
                    )}
                  >
                    {formatRiskLabel(simulation.overallRisk)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Risk score {simulation.riskScore.toFixed(3)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Signal Snapshot</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timepoints</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{weeks.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{weeks.map(weekLabel).join(" • ")}</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Flagged Findings</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {simulation.evaluations.filter((evaluation) => evaluation.status !== "PASS").length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Borderline and fail evaluations with coordinator-facing reasoning
              </p>
            </div>
          </div>
        </div>
      </section>

      <section ref={timelineSectionRef} className="space-y-4 rounded-[2rem] border border-border/70 bg-card/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Timeline Grid</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Eligibility trajectory across study weeks</h2>
          </div>
          <div className="flex flex-col items-end gap-3">
            <ExportMenu
              fileBaseName={`simulation-${simulation.id}-timeline`}
              csvRows={timelineExportRows}
              jsonData={simulation.evaluations}
              imageTargetRef={timelineSectionRef}
            />
            <div className="hidden flex-wrap gap-3 md:flex">
              {Object.entries(STATUS_COLORS).map(([status, config]) => (
                <div key={status} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("h-3 w-3 rounded-full", config.bg)} />
                  <span>{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[21rem] bg-card/95 px-4 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Criterion
                </th>
                {weeks.map((week) => (
                  <th
                    key={week}
                    className="min-w-[6.5rem] px-4 py-4 text-center text-xs uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {weekLabel(week)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row) => (
                <tr key={row.key}>
                  <td className="sticky left-0 z-10 border-t border-border/40 bg-card/95 px-4 py-4 align-top">
                    <p className="font-medium text-foreground" title={row.label}>
                      {row.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.parameter} • {row.category === "INCLUSION" ? "Inclusion" : "Exclusion"}
                    </p>
                  </td>
                  {weeks.map((week) => {
                    const evaluation = row.cells.get(week);
                    if (!evaluation) {
                      return (
                        <td key={`${row.key}-${week}`} className="border-t border-border/40 px-4 py-4 text-center">
                          <span className="inline-block h-3 w-3 rounded-full bg-muted/60" />
                        </td>
                      );
                    }

                    const config = STATUS_COLORS[evaluation.status];
                    return (
                      <td key={`${row.key}-${week}`} className="border-t border-border/40 px-4 py-4 text-center">
                        <button
                          type="button"
                          title={tooltipText(evaluation)}
                          className={cn(
                            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/40 transition-transform hover:scale-105",
                            selectedEvaluationId === evaluation.id ? `ring-2 ${config.ring}` : "",
                          )}
                          onClick={() => handleSelectEvaluation(evaluation)}
                        >
                          <span className={cn("h-4 w-4 rounded-full", config.bg)} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:hidden">
          {weeks.map((week) => {
            const weekEvaluations = simulation.evaluations
              .filter((evaluation) => evaluation.week === week)
              .sort((left, right) => left.criterionText.localeCompare(right.criterionText));

            return (
              <div key={week} className="rounded-[1.5rem] border border-border/60 bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{weekLabel(week)}</h3>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {weekEvaluations.length} checks
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {weekEvaluations.map((evaluation) => {
                    const config = STATUS_COLORS[evaluation.status];
                    return (
                      <button
                        key={evaluation.id}
                        type="button"
                        className={cn(
                          "w-full rounded-[1.25rem] border border-border/60 bg-card/50 p-4 text-left",
                          selectedEvaluationId === evaluation.id ? `ring-2 ${config.ring}` : "",
                        )}
                        onClick={() => handleSelectEvaluation(evaluation)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{evaluation.criterionText}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {evaluation.parameter} {OPERATOR_DISPLAY[evaluation.operator] ?? evaluation.operator}{" "}
                              {evaluation.threshold ?? "-"}
                            </p>
                          </div>
                          <span className={cn("mt-1 h-3.5 w-3.5 rounded-full", config.bg)} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section ref={reasoningSectionRef} className="space-y-5 rounded-[2rem] border border-border/70 bg-card/60 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Reasoning Traces</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Coordinator-ready explanations for flagged findings</h2>
          </div>
          {reasoningExportRows.length > 0 ? (
            <ExportMenu
              fileBaseName={`simulation-${simulation.id}-reasoning`}
              csvRows={reasoningExportRows}
              jsonData={simulation.evaluations.filter((evaluation) => evaluation.reasoning)}
              imageTargetRef={reasoningSectionRef}
            />
          ) : null}
        </div>

        {flaggedByWeek.length === 0 ? (
          <EmptyState
            icon={Microscope}
            title="No flagged findings"
            description="This simulation did not produce borderline or failing evaluations. Reasoning traces are only generated for elevated-risk findings."
          />
        ) : (
          <div className="space-y-6">
            {flaggedByWeek.map((group) => (
              <div key={group.week} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                    {weekLabel(group.week)}
                  </span>
                  <p className="text-sm text-muted-foreground">{group.evaluations.length} flagged evaluations</p>
                </div>

                <div className="grid gap-4">
                  {group.evaluations.map((evaluation) => {
                    const config = STATUS_COLORS[evaluation.status];
                    const reasoning = evaluation.reasoning;
                    return (
                      <article
                        key={evaluation.id}
                        ref={(element) => {
                          reasoningRefs.current[evaluation.id] = element;
                        }}
                        className={cn(
                          "rounded-[1.5rem] border border-border/70 bg-background/35 p-5 transition-all",
                          selectedEvaluationId === evaluation.id ? `ring-2 ${config.ring}` : "",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", findingBadgeTone(evaluation.status))}>
                                {STATUS_COLORS[evaluation.status].label}
                              </span>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {weekLabel(evaluation.week)}
                              </p>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">{evaluation.criterionText}</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {evaluation.parameter} {OPERATOR_DISPLAY[evaluation.operator] ?? evaluation.operator}{" "}
                                {evaluation.threshold ?? "-"} • projected {evaluation.projectedValue ?? "N/A"} • margin{" "}
                                {evaluation.marginPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          <div className="rounded-[1.25rem] border border-border/60 bg-card/60 px-4 py-3 text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Confidence</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {(evaluation.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>

                        {reasoning ? (
                          <div className="mt-5 space-y-4">
                            <div className="rounded-[1.25rem] border border-border/60 bg-card/70 p-4">
                              <p className="text-sm leading-7 text-foreground">{reasoning.explanation}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {reasoning.riskFactors.map((factor) => (
                                <span
                                  key={`${evaluation.id}-${factor}`}
                                  className="rounded-full border border-border/60 bg-background/45 px-3 py-1 text-xs text-muted-foreground"
                                >
                                  {factor}
                                </span>
                              ))}
                            </div>
                            {reasoning.suggestion ? (
                              <div className="rounded-[1.25rem] border border-cyan-300/20 bg-cyan-300/8 p-4">
                                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Suggested Action</p>
                                <p className="mt-2 text-sm text-foreground">{reasoning.suggestion}</p>
                              </div>
                            ) : null}
                            <p className="text-xs text-muted-foreground">{reasoning.confidenceNote}</p>
                          </div>
                        ) : (
                          <div className="mt-5 rounded-[1.25rem] border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                            Reasoning traces will be generated for borderline and failing criteria.
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {parameterCharts.length > 0 ? (
        <section ref={chartsSectionRef} className="space-y-4 rounded-[2rem] border border-border/70 bg-card/60 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Parameter Trend Projections</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Projected values across the trial timeline based on historical trends</h2>
            </div>
            <ExportMenu
              fileBaseName={`simulation-${simulation.id}-parameter-projections`}
              csvRows={parameterChartExportRows}
              jsonData={parameterCharts}
              imageTargetRef={chartsSectionRef}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {parameterCharts.map((chart) => (
              <div key={chart.parameter} className="rounded-[1.5rem] border border-border/60 bg-background/35 p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {chart.parameter} Projection{chart.unit ? ` (${chart.unit})` : ""}
                  </h3>
                  <p className="text-sm text-muted-foreground">{chart.trendLabel}</p>
                </div>

                <div className="mt-4 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart.points} margin={{ top: 18, right: 16, bottom: 8, left: -16 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                      <XAxis
                        dataKey="week"
                        stroke="rgba(148, 163, 184, 0.75)"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => weekLabel(Number(value))}
                      />
                      <YAxis
                        stroke="rgba(148, 163, 184, 0.75)"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                        width={52}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.96)",
                          border: "1px solid rgba(71, 85, 105, 0.6)",
                          borderRadius: "16px",
                          color: "#e2e8f0",
                        }}
                        formatter={(value: number, _name, item) => [
                          chartTooltipValue(Number(value)),
                          item.dataKey === "value" ? "Projected Value" : "Threshold",
                        ]}
                        labelFormatter={(label) => weekLabel(Number(label))}
                      />
                      {chart.points[0]?.threshold !== null ? (
                        <ReferenceLine
                          y={chart.points[0]?.threshold ?? undefined}
                          stroke="#ef4444"
                          strokeDasharray="6 6"
                          label={{
                            value: `Threshold: ${chart.points[0]?.threshold}`,
                            fill: "#fca5a5",
                            fontSize: 11,
                            position: "insideTopRight",
                          }}
                        />
                      ) : null}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        dot={<StatusDot />}
                        activeDot={{ r: 6, fill: "#22d3ee", stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-border/70 bg-card/60 p-6">
        <div className="flex items-start gap-3">
          <Radar className="mt-1 h-5 w-5 text-cyan-300" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">How to read this simulation</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              The grid shows how each eligibility rule behaves across trial timepoints. Click any yellow or red cell to
              jump to its reasoning trace, which explains the projected breach in coordinator-friendly language.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
