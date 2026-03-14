"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, RefreshCcw, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ExportMenu } from "@/components/common/ExportMenu";
import { PageHeader } from "@/components/common/PageHeader";
import { ProtocolStatusBadge } from "@/components/protocols/ProtocolStatusBadge";
import { Button } from "@/components/ui/button";
import { protocolAPI } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import type { Protocol } from "@/types/models";

interface SelectedFileState {
  file: File;
  label: string;
}

type UploadStage = "idle" | "uploading" | "extracting" | "success" | "error";

function formatFileSize(file: File): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = file.size;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function ProtocolsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const extractionTimerRef = useRef<number | null>(null);
  const tableSectionRef = useRef<HTMLElement | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [criteriaExtracted, setCriteriaExtracted] = useState<number | null>(null);

  const hasProtocols = protocols.length > 0;
  const disableUpload = !selectedFile || uploadStage === "uploading" || uploadStage === "extracting";

  useEffect(() => {
    void loadProtocols();
    return () => {
      if (extractionTimerRef.current) {
        window.clearTimeout(extractionTimerRef.current);
      }
    };
  }, []);

  async function loadProtocols() {
    setLoading(true);
    try {
      const response = await protocolAPI.list();
      setProtocols(response.data ?? []);
    } catch (error) {
      console.error("Failed to load protocols", error);
      setUploadMessage(error instanceof Error ? error.message : "Failed to load protocols.");
    } finally {
      setLoading(false);
    }
  }

  function queueFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadStage("error");
      setUploadMessage("Only PDF files are accepted.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile({ file, label: `${file.name} • ${formatFileSize(file)}` });
    setUploadStage("idle");
    setUploadMessage(null);
    setCriteriaExtracted(null);
  }

  async function handleUpload() {
    if (!selectedFile || disableUpload) {
      return;
    }

    setUploadStage("uploading");
    setUploadMessage("Uploading...");
    setCriteriaExtracted(null);
    extractionTimerRef.current = window.setTimeout(() => {
      setUploadStage("extracting");
      setUploadMessage("Extracting criteria...");
    }, 1200);

    try {
      const response = await protocolAPI.upload(selectedFile.file);
      if (extractionTimerRef.current) {
        window.clearTimeout(extractionTimerRef.current);
      }
      const protocol = response.data;
      setUploadStage("success");
      setCriteriaExtracted(protocol?.criteriaCount ?? null);
      setUploadMessage(
        protocol ? `Done! ${protocol.criteriaCount} criteria extracted.` : "Upload completed.",
      );
      await loadProtocols();
      if (protocol) {
        router.push(`/protocols/${protocol.id}`);
      }
    } catch (error) {
      if (extractionTimerRef.current) {
        window.clearTimeout(extractionTimerRef.current);
      }
      setUploadStage("error");
      setUploadMessage(error instanceof Error ? error.message : "Extraction failed.");
    }
  }

  const sortedProtocols = useMemo(
    () => [...protocols].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [protocols],
  );

  const protocolExportRows = useMemo(
    () =>
      sortedProtocols.map((protocol) => ({
        id: protocol.id,
        name: protocol.name,
        version: protocol.version,
        status: protocol.status,
        criteriaCount: protocol.criteriaCount,
        uploadedDate: protocol.createdAt,
      })),
    [sortedProtocols],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Protocols"
        description="Upload and manage clinical trial protocols"
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {hasProtocols ? (
              <ExportMenu
                fileBaseName="meditwin-protocols"
                csvRows={protocolExportRows}
                jsonData={sortedProtocols}
                imageTargetRef={tableSectionRef}
              />
            ) : null}
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              Upload PDF
            </Button>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            queueFile(file);
          }
        }}
      />

      <section
        className={cn(
          "rounded-[2rem] border border-dashed p-6 transition-colors md:p-8",
          dragging ? "border-cyan-400 bg-cyan-400/10" : "border-cyan-400/30 bg-cyan-400/5",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) {
            queueFile(file);
          }
        }}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Drop a protocol PDF to extract criteria</h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                Upload a protocol, send the eligibility sections through Groq, and review the structured inclusion and
                exclusion rules before screening patients.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.75rem] border border-border/70 bg-card/60 p-4 sm:min-w-[22rem]">
            <p className="text-sm font-medium text-foreground">
              {selectedFile ? selectedFile.label : "No file selected yet"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {uploadMessage ?? "PDF only. Large protocols may take 10-30 seconds to extract."}
            </p>
            {criteriaExtracted !== null ? (
              <p className="mt-2 text-sm text-emerald-300">{criteriaExtracted} structured criteria ready for review.</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              <Button disabled={disableUpload} onClick={handleUpload}>
                {uploadStage === "uploading" || uploadStage === "extracting" ? "Working..." : "Upload & Extract"}
              </Button>
              {uploadStage === "error" ? (
                <Button variant="ghost" onClick={handleUpload} disabled={!selectedFile}>
                  <RefreshCcw className="h-4 w-4" />
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[2rem] border border-border/70 bg-card/50 p-8 text-sm text-muted-foreground">
          Loading protocols...
        </div>
      ) : hasProtocols ? (
        <section ref={tableSectionRef} className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/50">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-4 font-medium">Protocol Name</th>
                  <th className="px-4 py-4 font-medium">Version</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Criteria Count</th>
                  <th className="px-4 py-4 font-medium">Uploaded Date</th>
                  <th className="px-4 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProtocols.map((protocol) => (
                  <tr
                    key={protocol.id}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30"
                    onClick={() => router.push(`/protocols/${protocol.id}`)}
                  >
                    <td className="px-4 py-4 font-medium text-foreground">{protocol.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{protocol.version}</td>
                    <td className="px-4 py-4"><ProtocolStatusBadge status={protocol.status} /></td>
                    <td className="px-4 py-4 text-muted-foreground">{protocol.criteriaCount}</td>
                    <td className="px-4 py-4 text-muted-foreground">{formatDate(protocol.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Button
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/protocols/${protocol.id}`);
                        }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={FileUp}
          title="No protocols uploaded yet"
          description="Start by uploading a protocol PDF. The extracted criteria will appear here for review and confirmation."
          action={
            <Button onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              Select Protocol PDF
            </Button>
          }
        />
      )}
    </div>
  );
}

