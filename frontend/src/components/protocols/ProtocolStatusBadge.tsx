"use client";

import { cn } from "@/lib/utils";
import type { Protocol } from "@/types/models";

const STATUS_STYLES: Record<Protocol["status"], string> = {
  PROCESSING: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  EXTRACTED: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  CONFIRMED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  FAILED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
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
