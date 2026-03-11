"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, PencilLine, RefreshCcw } from "lucide-react";

import { CriterionEditorDialog } from "@/components/protocols/CriterionEditorDialog";
import { ProtocolStatusBadge } from "@/components/protocols/ProtocolStatusBadge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { protocolAPI } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { CriterionRule, ProtocolWithCriteria } from "@/types/models";

const OPERATOR_DISPLAY: Record<CriterionRule["operator"], string> = {
  GTE: ">=",
  LTE: "<=",
  EQ: "=",
  NEQ: "!=",
  BOOLEAN: "Has/Doesn't Have",
  NOT_WITHIN: "Not Within",
  STABLE: "Stable",
};

function thresholdLabel(criterion: CriterionRule): string {
  if (criterion.threshold === null) {
    return "-";
  }
  return `${criterion.threshold}${criterion.unit ? ` ${criterion.unit}` : ""}`;
}

function confidenceColor(confidence: number): string {
  if (confidence > 0.85) {
    return "bg-emerald-400";
  }
  if (confidence >= 0.6) {
    return "bg-amber-400";
  }
  return "bg-rose-400";
}

export default function ProtocolDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const protocolId = params.id;
  const [protocol, setProtocol] = useState<ProtocolWithCriteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<CriterionRule | null>(null);
  const [savingCriterion, setSavingCriterion] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (!protocolId) {
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await protocolAPI.getById(protocolId);
        setProtocol(response.data ?? null);
      } catch (fetchError) {
        console.error("Failed to load protocol", fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load protocol.");
      } finally {
        setLoading(false);
      }
    })();
  }, [protocolId]);

  async function reloadProtocol() {
    setLoading(true);
    setError(null);
    try {
      const response = await protocolAPI.getById(protocolId);
      setProtocol(response.data ?? null);
    } catch (fetchError) {
      console.error("Failed to load protocol", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load protocol.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCriterion(data: Partial<CriterionRule>) {
    if (!editingCriterion || !protocol) {
      return;
    }

    const currentId = editingCriterion.id;
    const previousCriteria = protocol.criteria;
    const nextCriteria = previousCriteria.map((criterion) =>
      criterion.id === currentId ? { ...criterion, ...data } : criterion,
    );

    setSavingCriterion(true);
    setProtocol({ ...protocol, criteria: nextCriteria });

    try {
      const response = await protocolAPI.updateCriterion(currentId, data);
      const savedCriterion = response.data;
      if (savedCriterion) {
        setProtocol((current) =>
          current
            ? {
                ...current,
                criteria: current.criteria.map((criterion) =>
                  criterion.id === currentId ? savedCriterion : criterion,
                ),
              }
            : current,
        );
      }
      setEditingCriterion(null);
    } catch (saveError) {
      console.error("Failed to update criterion", saveError);
      setProtocol({ ...protocol, criteria: previousCriteria });
      setError(saveError instanceof Error ? saveError.message : "Failed to update criterion.");
    } finally {
      setSavingCriterion(false);
    }
  }

  async function handleConfirmProtocol() {
    if (!protocol) {
      return;
    }

    setConfirming(true);
    try {
      const response = await protocolAPI.confirm(protocol.id);
      setProtocol((current) =>
        current && response.data
          ? { ...current, status: response.data.status, updatedAt: response.data.updatedAt }
          : current,
      );
      setShowConfirmDialog(false);
    } catch (confirmError) {
      console.error("Failed to confirm protocol", confirmError);
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm protocol.");
    } finally {
      setConfirming(false);
    }
  }

  const groupedCriteria = useMemo(() => {
    if (!protocol) {
      return { inclusion: [], exclusion: [] };
    }

    return {
      inclusion: protocol.criteria.filter((criterion) => criterion.category === "INCLUSION"),
      exclusion: protocol.criteria.filter((criterion) => criterion.category === "EXCLUSION"),
    };
  }, [protocol]);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-border/70 bg-card/50 p-8 text-sm text-muted-foreground">
        Loading protocol...
      </div>
    );
  }

  if (error && !protocol) {
    return (
      <div className="space-y-4 rounded-[2rem] border border-rose-400/30 bg-rose-400/5 p-8">
        <p className="text-lg font-semibold text-foreground">Protocol could not be loaded</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => void reloadProtocol()}>Retry</Button>
      </div>
    );
  }

  if (!protocol) {
    return null;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/70 bg-card/50 p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Protocol Review</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-foreground">{protocol.name}</h1>
              <ProtocolStatusBadge status={protocol.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Version {protocol.version} • {protocol.criteriaCount} criteria • uploaded {formatDate(protocol.createdAt)}
            </p>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {protocol.status === "EXTRACTED" ? (
              <Button onClick={() => setShowConfirmDialog(true)} disabled={confirming}>
                {confirming ? "Confirming..." : "Confirm Criteria"}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => router.push(ROUTES.PROTOCOLS)}>
              <RefreshCcw className="h-4 w-4" />
              Re-extract
            </Button>
            {protocol.status === "CONFIRMED" ? (
              <Button onClick={() => router.push(`${ROUTES.PATIENTS}?protocol_id=${protocol.id}`)}>
                Screen Patients
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {(["inclusion", "exclusion"] as const).map((groupKey) => {
          const title = groupKey === "inclusion" ? "Inclusion Criteria" : "Exclusion Criteria";
          const criteria = groupedCriteria[groupKey];
          const badgeClass = groupKey === "inclusion" ? "text-emerald-200" : "text-rose-200";

          return (
            <div key={groupKey} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className={cn("text-2xl font-semibold", badgeClass)}>{title}</h2>
                <span className="text-sm text-muted-foreground">{criteria.length} rules</span>
              </div>

              <div className="space-y-4 sm:hidden">
                {criteria.map((criterion, index) => (
                  <article key={criterion.id} className="rounded-[1.75rem] border border-border/70 bg-card/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">#{index + 1}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{criterion.originalText}</p>
                      </div>
                      {criterion.requiresReview ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : null}
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      <p>Parameter: {criterion.parameter}</p>
                      <p>Operator: {OPERATOR_DISPLAY[criterion.operator]}</p>
                      <p>Threshold: {thresholdLabel(criterion)}</p>
                      <p>Schedule: {criterion.evalSchedule.map((week) => `Wk ${week}`).join(", ") || "-"}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="w-full max-w-[10rem] rounded-full bg-muted/70">
                        <div
                          className={cn("h-2 rounded-full", confidenceColor(criterion.confidence))}
                          style={{ width: `${Math.max(8, criterion.confidence * 100)}%` }}
                        />
                      </div>
                      <Button variant="outline" onClick={() => setEditingCriterion(criterion)}>
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-[1.75rem] border border-border/70 bg-card/50 sm:block">
                <table className="min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-border/70 bg-background/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-4 font-medium">#</th>
                      <th className="px-4 py-4 font-medium">Category</th>
                      <th className="px-4 py-4 font-medium">Original Text</th>
                      <th className="px-4 py-4 font-medium">Parameter</th>
                      <th className="px-4 py-4 font-medium">Operator</th>
                      <th className="px-4 py-4 font-medium">Threshold + Unit</th>
                      <th className="px-4 py-4 font-medium">Eval Schedule</th>
                      <th className="px-4 py-4 font-medium">Confidence</th>
                      <th className="px-4 py-4 font-medium">Review</th>
                      <th className="px-4 py-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((criterion, index) => (
                      <tr key={criterion.id} className="border-b border-border/50 align-top">
                        <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                              criterion.category === "INCLUSION"
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                                : "border-rose-400/30 bg-rose-400/10 text-rose-200",
                            )}
                          >
                            {criterion.category}
                          </span>
                        </td>
                        <td className="sticky left-0 max-w-[26rem] bg-card/50 px-4 py-4 font-medium text-foreground">
                          {criterion.originalText}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{criterion.parameter}</td>
                        <td className="px-4 py-4 text-muted-foreground">{OPERATOR_DISPLAY[criterion.operator]}</td>
                        <td className="px-4 py-4 text-muted-foreground">{thresholdLabel(criterion)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {criterion.evalSchedule.map((week) => (
                              <span
                                key={`${criterion.id}-${week}`}
                                className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200"
                              >
                                Wk {week}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="w-28 rounded-full bg-muted/70">
                            <div
                              className={cn("h-2 rounded-full", confidenceColor(criterion.confidence))}
                              style={{ width: `${Math.max(8, criterion.confidence * 100)}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{criterion.confidence.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-4">
                          {criterion.requiresReview ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <Button variant="outline" onClick={() => setEditingCriterion(criterion)}>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      {editingCriterion ? (
        <CriterionEditorDialog
          key={editingCriterion.id}
          criterion={editingCriterion}
          saving={savingCriterion}
          onClose={() => setEditingCriterion(null)}
          onSave={handleSaveCriterion}
        />
      ) : null}

      {showConfirmDialog ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-border/70 bg-background p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Confirm Protocol</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Mark extracted criteria as confirmed?</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              This will mark {protocol.criteriaCount} criteria as confirmed and allow patient screening.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={confirming}>
                Cancel
              </Button>
              <Button onClick={() => void handleConfirmProtocol()} disabled={confirming}>
                {confirming ? "Confirming..." : "Confirm Criteria"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

