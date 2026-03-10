"use client";

interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = "Loading workspace" }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-300" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
