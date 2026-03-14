"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { Braces, Download, FileImage, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportDataToJson, exportElementToPng, exportRowsToCsv, type ExportRow } from "@/lib/export";

interface ExportMenuProps {
  fileBaseName: string;
  csvRows: ExportRow[];
  jsonData: unknown;
  imageTargetRef?: RefObject<HTMLElement | null>;
  label?: string;
  align?: "left" | "right";
}

export function ExportMenu({
  fileBaseName,
  csvRows,
  jsonData,
  imageTargetRef,
  label = "Download",
  align = "right",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"csv" | "json" | "image" | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleCsvExport() {
    setBusy("csv");
    try {
      exportRowsToCsv(`${fileBaseName}.csv`, csvRows);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  async function handleJsonExport() {
    setBusy("json");
    try {
      exportDataToJson(`${fileBaseName}.json`, jsonData);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  async function handleImageExport() {
    if (!imageTargetRef?.current) {
      return;
    }
    setBusy("image");
    try {
      await exportElementToPng(`${fileBaseName}.png`, imageTargetRef.current);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Download className="h-4 w-4" />
        {label}
      </Button>

      {open ? (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-2 min-w-[12rem] rounded-2xl border border-border/70 bg-popover/95 backdrop-blur-md p-2 shadow-2xl ${align === "left" ? "left-0" : "right-0"
            }`}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted/70"
            onClick={() => void handleCsvExport()}
            disabled={busy !== null}
          >
            <FileText className="h-4 w-4 text-primary" />
            {busy === "csv" ? "Preparing CSV..." : "Download CSV"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted/70"
            onClick={() => void handleJsonExport()}
            disabled={busy !== null}
          >
            <Braces className="h-4 w-4 text-primary" />
            {busy === "json" ? "Preparing JSON..." : "Download JSON"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleImageExport()}
            disabled={busy !== null || !imageTargetRef?.current}
          >
            <FileImage className="h-4 w-4 text-primary" />
            {busy === "image" ? "Rendering image..." : "Download PNG"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
