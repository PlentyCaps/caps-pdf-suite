"use client";

import { useState, useRef, useCallback } from "react";
import {
  RefreshCw,
  Upload,
  X,
  Download,
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileType,
  Table,
} from "lucide-react";
import Link from "next/link";

type ConvertMode = "word" | "excel";
type Status = "idle" | "loading" | "done" | "error";

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Extract text items with positions from all pages
async function extractTextItems(file: File): Promise<{ pages: TextItem[][] }> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  const buf = await file.arrayBuffer();
  const doc = await getDocument({ data: buf }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        const tx = (item as { transform: number[]; str: string; width: number; height: number }).transform;
        items.push({
          str: (item as { str: string }).str,
          x: Math.round(tx[4]),
          y: Math.round(viewport.height - tx[5]),
          width: Math.round((item as { width: number }).width),
          height: Math.round((item as { height: number }).height),
        });
      }
    }
    pages.push(items);
  }
  return { pages };
}

// Group text items into lines (rows with similar y values)
function groupIntoLines(items: TextItem[], tolerance = 5): TextItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(item.y - lastLine[0].y) <= tolerance) {
      lastLine.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

// Detect columns by clustering x positions
function detectColumns(lines: TextItem[][]): number[] {
  const xPositions = lines.flatMap((l) => l.map((i) => i.x));
  const sorted = [...new Set(xPositions)].sort((a, b) => a - b);
  const cols: number[] = [];
  for (const x of sorted) {
    if (cols.length === 0 || x - cols[cols.length - 1] > 20) cols.push(x);
  }
  return cols;
}

// Assign item to nearest column
function assignCol(x: number, cols: number[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const d = Math.abs(x - cols[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

async function convertToWord(file: File): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const { pages } = await extractTextItems(file);

  const docParagraphs = [];

  // Title from filename
  docParagraphs.push(
    new Paragraph({
      text: file.name.replace(".pdf", ""),
      heading: HeadingLevel.HEADING_1,
    })
  );

  for (let p = 0; p < pages.length; p++) {
    if (pages.length > 1) {
      docParagraphs.push(
        new Paragraph({
          text: `Page ${p + 1}`,
          heading: HeadingLevel.HEADING_2,
        })
      );
    }

    const lines = groupIntoLines(pages[p]);

    for (const line of lines) {
      const text = line.map((i) => i.str).join(" ").trim();
      if (!text) continue;

      // Heuristic: short lines at top of page might be headings
      const isShort = text.length < 60 && line.length <= 3;
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isShort,
              size: isShort ? 24 : 20,
            }),
          ],
        })
      );
    }

    // Page break between pages
    if (p < pages.length - 1) {
      docParagraphs.push(new Paragraph({ text: "", pageBreakBefore: true }));
    }
  }

  const doc = new Document({ sections: [{ children: docParagraphs }] });
  const buffer = await Packer.toBuffer(doc);
  return new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

async function convertToExcel(file: File): Promise<Blob> {
  const XLSX = await import("xlsx");
  const { pages } = await extractTextItems(file);
  const wb = XLSX.utils.book_new();

  for (let p = 0; p < pages.length; p++) {
    const lines = groupIntoLines(pages[p], 8);
    if (lines.length === 0) continue;

    const cols = detectColumns(lines);
    const grid: string[][] = [];

    for (const line of lines) {
      const row: string[] = Array(cols.length).fill("");
      for (const item of line) {
        const col = assignCol(item.x, cols);
        row[col] = row[col] ? row[col] + " " + item.str : item.str;
      }
      // Skip completely empty rows
      if (row.some((c) => c.trim())) grid.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(grid);

    // Auto column widths
    const colWidths = cols.map((_, ci) =>
      Math.min(50, Math.max(10, ...grid.map((r) => (r[ci] || "").length)))
    );
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    const sheetName = pages.length > 1 ? `Page ${p + 1}` : "Sheet1";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export default function ConvertPage() {
  const [mode, setMode] = useState<ConvertMode>("word");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setFileName(f.name);
    setFileSize(formatBytes(f.size));
    setStatus("idle");
    setDownloadUrl(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const reset = () => {
    setFile(null);
    setFileName("");
    setFileSize("");
    setStatus("idle");
    setDownloadUrl(null);
  };

  const convert = async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMsg("");
    setDownloadUrl(null);
    try {
      let blob: Blob;
      let name: string;
      const base = fileName.replace(/\.pdf$/i, "");
      if (mode === "word") {
        blob = await convertToWord(file);
        name = `${base}.docx`;
      } else {
        blob = await convertToExcel(file);
        name = `${base}-tables.xlsx`;
      }
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadName(name);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("Conversion failed. Make sure the PDF contains selectable text (not scanned images).");
      setStatus("error");
    }
  };

  const modes: { key: ConvertMode; label: string; icon: React.ElementType; desc: string; accent: string }[] = [
    {
      key: "word",
      label: "PDF → Word",
      icon: FileType,
      desc: "Extract text and structure into an editable .docx file",
      accent: "from-green-500 to-green-600",
    },
    {
      key: "excel",
      label: "Tables → Excel",
      icon: Table,
      desc: "Detect and extract tables into a .xlsx spreadsheet",
      accent: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Convert PDFs</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Convert PDF Files</h1>
          <p className="text-gray-400">
            Turn your PDFs into editable Word documents or extract tables to Excel.
          </p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setStatus("idle"); setDownloadUrl(null); }}
                className={`flex items-start gap-4 p-5 rounded-2xl border text-left transition-all duration-200 ${
                  mode === m.key
                    ? "border-green-500/50 bg-green-950/30"
                    : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                }`}
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${m.accent} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={`font-semibold mb-1 ${mode === m.key ? "text-green-400" : "text-gray-200"}`}>
                    {m.label}
                  </p>
                  <p className="text-sm text-gray-500">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Notice */}
        <div className="mb-6 flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
          Works best with text-based PDFs. Scanned or image-only PDFs may produce limited results.
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragging ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? "text-green-400" : "text-gray-500"}`} />
            <p className="text-gray-300 font-medium mb-1">
              {dragging ? "Drop your PDF here" : "Click or drag a PDF here"}
            </p>
            <p className="text-gray-500 text-sm">One PDF file at a time</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6">
            <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{fileName}</p>
              <p className="text-sm text-gray-500">{fileSize}</p>
            </div>
            <button onClick={reset} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mb-6 flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        {file && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={convert}
              disabled={status === "loading"}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Converting…</>
              ) : (
                <><RefreshCw className="w-5 h-5" />
                  {mode === "word" ? "Convert to Word (.docx)" : "Extract tables to Excel (.xlsx)"}
                </>
              )}
            </button>

            {status === "done" && downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                Download {mode === "word" ? ".docx" : ".xlsx"}
              </a>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm justify-center">
            <CheckCircle className="w-4 h-4" />
            Conversion complete! Your file is ready to download.
          </div>
        )}
      </main>
    </div>
  );
}
