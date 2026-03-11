"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CriterionRule } from "@/types/models";

const OPERATORS: CriterionRule["operator"][] = [
  "GTE",
  "LTE",
  "EQ",
  "NEQ",
  "BOOLEAN",
  "NOT_WITHIN",
  "STABLE",
];

interface CriterionEditorDialogProps {
  criterion: CriterionRule;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Partial<CriterionRule>) => Promise<void>;
}

interface FormState {
  parameter: string;
  operator: CriterionRule["operator"];
  threshold: string;
  unit: string;
  timeWindow: string;
  evalSchedule: string;
  requiresReview: boolean;
  confidence: string;
}

function buildFormState(criterion: CriterionRule): FormState {
  return {
    parameter: criterion.parameter,
    operator: criterion.operator,
    threshold: criterion.threshold?.toString() ?? "",
    unit: criterion.unit ?? "",
    timeWindow: criterion.timeWindow?.toString() ?? "",
    evalSchedule: criterion.evalSchedule.join(", "),
    requiresReview: criterion.requiresReview,
    confidence: criterion.confidence.toString(),
  };
}

export function CriterionEditorDialog({
  criterion,
  saving,
  onClose,
  onSave,
}: CriterionEditorDialogProps) {
  const [formState, setFormState] = useState<FormState>(() => buildFormState(criterion));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
      <div className="w-full max-w-3xl rounded-[2rem] border border-border/70 bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Manual Review</p>
            <h2 className="text-2xl font-semibold text-foreground">Edit extracted criterion</h2>
            <p className="text-sm text-muted-foreground">{criterion.originalText}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Parameter</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.parameter}
              onChange={(event) => setFormState((current) => ({ ...current, parameter: event.target.value }))}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Operator</span>
            <select
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.operator}
              onChange={(event) =>
                setFormState((current) => ({ ...current, operator: event.target.value as CriterionRule["operator"] }))
              }
            >
              {OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Threshold</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.threshold}
              onChange={(event) => setFormState((current) => ({ ...current, threshold: event.target.value }))}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Unit</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.unit}
              onChange={(event) => setFormState((current) => ({ ...current, unit: event.target.value }))}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Time Window (days)</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.timeWindow}
              onChange={(event) => setFormState((current) => ({ ...current, timeWindow: event.target.value }))}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.confidence}
              onChange={(event) => setFormState((current) => ({ ...current, confidence: event.target.value }))}
            />
          </label>

          <label className="space-y-2 text-sm md:col-span-2">
            <span className="text-muted-foreground">Eval Schedule (comma-separated weeks)</span>
            <input
              className="w-full rounded-2xl border border-border/70 bg-card/60 px-4 py-3 outline-none"
              value={formState.evalSchedule}
              onChange={(event) => setFormState((current) => ({ ...current, evalSchedule: event.target.value }))}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-sm md:col-span-2">
            <input
              checked={formState.requiresReview}
              type="checkbox"
              onChange={(event) => setFormState((current) => ({ ...current, requiresReview: event.target.checked }))}
            />
            <span>Requires manual coordinator review</span>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              await onSave({
                parameter: formState.parameter,
                operator: formState.operator,
                threshold: formState.threshold.trim() ? Number(formState.threshold) : null,
                unit: formState.unit.trim() || null,
                timeWindow: formState.timeWindow.trim() ? Number(formState.timeWindow) : null,
                evalSchedule: formState.evalSchedule
                  .split(",")
                  .map((value) => Number(value.trim()))
                  .filter((value) => Number.isFinite(value)),
                requiresReview: formState.requiresReview,
                confidence: formState.confidence.trim() ? Number(formState.confidence) : criterion.confidence,
              });
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

