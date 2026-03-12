"use client";

import { toPng } from "html-to-image";

type ExportPrimitive = string | number | boolean | null | undefined | Date;
export type ExportValue = ExportPrimitive | ExportValue[] | Record<string, unknown>;
export type ExportRow = Record<string, ExportValue>;

function normalizeValue(value: ExportValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvCell(value: ExportValue): string {
  const normalized = normalizeValue(value);
  const escaped = normalized.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRowsToCsv(filename: string, rows: ExportRow[]): void {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(",")),
  ].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportDataToJson(filename: string, data: unknown): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" }),
    filename,
  );
}

export async function exportElementToPng(filename: string, element: HTMLElement): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#08111f",
    skipFonts: false,
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(blob, filename);
}
