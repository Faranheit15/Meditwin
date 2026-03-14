"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label, className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 blur-[2px]" />
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
      {label && (
        <p className="text-sm font-medium tracking-wide text-cyan-800/80 dark:text-cyan-300/60 uppercase">
          {label}
        </p>
      )}
    </div>
  );
}
