"use client";

import { cn } from "@/lib/utils";
import type { Protocol } from "@/types/models";

const STATUS_STYLES: Record<Protocol["status"], string> = {
  PROCESSING: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
  EXTRACTED: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
  FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
};

export function ProtocolStatusBadge({ status }: { status: Protocol["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
        STATUS_STYLES[status],
        status === "PROCESSING" && "animate-pulse",
      )}
    >
      {status}
    </span>
  );
}
