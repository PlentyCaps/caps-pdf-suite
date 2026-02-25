"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import {
  Scissors,
  Upload,
  X,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface Range {
  id: string;
  from: string;
  to: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function parseRange(from: string, to: string, total: number): number[] | null {
  const f = parseInt(from);
  const t = parseInt(to);
  if (isNaN(f) || isNaN(t)) return null;
  if (f < 1 || t > total || f > t) return null;
  return Array.from({ length: t - f + 1 }, (_, i) => f - 1 + i);
}

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [ranges, setRanges] = useState<Range[]>([{ id: crypto.randomUUID(), from: "", to: "" }]);
  const [mode, setMode] = useState<"ranges" | "all">("ranges");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("split.zip");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") return;
    try {
      const buf = await f.arrayBuffer();
      const doc = await PDFDocument.load(buf);
      setFile(f);
      setFileName(f.name);
      setFileSize(formatBytes(f.size));
      setPageCount(doc.getPageCount());
      setStatus("idle");
      setDownloadUrl(null);
    } catch {
      setErrorMsg("Could not read this PDF. Make sure it's a valid file.");
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const addRange = () =>
    setRanges((prev) => [...prev, { id: crypto.randomUUID(), from: "", to: "" }]);

  const removeRange = (id: string) =>
    setRanges((prev) => prev.filter((r) => r.id !== id));

  const updateRange = (id: string, field: "from" | "to", value: string) =>
    setRanges((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const rangeError = (r: Range): string | null => {
    if (!r.from || !r.to) return null;
    const f = parseInt(r.from), t = parseInt(r.to);
    if (isNaN(f) || isNaN(t)) return "Invalid number";
    if (f < 1) return `Min page is 1`;
    if (t > pageCount) return `Max page is ${pageCount}`;
    if (f > t) return "Start > end";
    return null;
  };

  const splitPDF = async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const buf = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buf);
      const zip = new JSZip();

      if (mode === "all") {
        // One PDF per page
        for (let i = 0; i < pageCount; i++) {
          const part = await PDFDocument.create();
          const [page] = await part.copyPages(srcDoc, [i]);
          part.addPage(page);
          const bytes = await part.save();
          zip.file(`page-${i + 1}.pdf`, new Uint8Array(bytes));
        }
        const blob = await zip.generateAsync({ type: "blob" });
        setDownloadUrl(URL.createObjectURL(blob));
        setDownloadName(`${fileName.replace(".pdf", "")}-split-all-pages.zip`);
      } else {
        // Custom ranges
        const validRanges = ranges.filter((r) => r.from && r.to && !rangeError(r));
        if (validRanges.length === 0) {
          setErrorMsg("Please add at least one valid page range.");
          setStatus("error");
          return;
        }
        if (validRanges.length === 1) {
          // Single range → direct PDF download
          const pages = parseRange(validRanges[0].from, validRanges[0].to, pageCount)!;
          const part = await PDFDocument.create();
          const copied = await part.copyPages(srcDoc, pages);
          copied.forEach((p) => part.addPage(p));
          const bytes = await part.save();
          const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
          setDownloadUrl(URL.createObjectURL(blob));
          setDownloadName(`${fileName.replace(".pdf", "")}-pages-${validRanges[0].from}-${validRanges[0].to}.pdf`);
        } else {
          // Multiple ranges → zip
          for (let i = 0; i < validRanges.length; i++) {
            const r = validRanges[i];
            const pages = parseRange(r.from, r.to, pageCount)!;
            const part = await PDFDocument.create();
            const copied = await part.copyPages(srcDoc, pages);
            copied.forEach((p) => part.addPage(p));
            const bytes = await part.save();
            zip.file(`part-${i + 1}-pages-${r.from}-${r.to}.pdf`, new Uint8Array(bytes));
          }
          const blob = await zip.generateAsync({ type: "blob" });
          setDownloadUrl(URL.createObjectURL(blob));
          setDownloadName(`${fileName.replace(".pdf", "")}-split.zip`);
        }
      }
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("Something went wrong while splitting. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setFileName("");
    setFileSize("");
    setPageCount(0);
    setRanges([{ id: crypto.randomUUID(), from: "", to: "" }]);
    setStatus("idle");
    setDownloadUrl(null);
    setMode("ranges");
  };

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
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Scissors className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Split PDFs</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Split PDF Files</h1>
          <p className="text-gray-400">
            Extract pages or split your PDF into multiple files by custom ranges.
          </p>
        </div>

        {/* Drop zone / file loaded */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragging ? "border-purple-500 bg-purple-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? "text-purple-400" : "text-gray-500"}`} />
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
          <>
            {/* File info card */}
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6">
              <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fileName}</p>
                <p className="text-sm text-gray-500">{fileSize} · {pageCount} pages</p>
              </div>
              <button onClick={reset} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
              {([
                { key: "ranges", label: "Custom ranges" },
                { key: "all", label: `Split all pages (${pageCount})` },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    mode === m.key
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Custom ranges */}
            {mode === "ranges" && (
              <div className="mb-6 space-y-3">
                <p className="text-sm text-gray-400 font-medium mb-2">
                  Define page ranges <span className="text-gray-600">(pages 1–{pageCount})</span>
                </p>
                {ranges.map((r, i) => {
                  const err = rangeError(r);
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-gray-600 text-sm w-16 flex-shrink-0">Part {i + 1}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="number"
                          min={1}
                          max={pageCount}
                          value={r.from}
                          onChange={(e) => updateRange(r.id, "from", e.target.value)}
                          placeholder="From"
                          className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${err ? "border-red-500" : "border-gray-700 hover:border-gray-600"}`}
                        />
                        <span className="text-gray-600 flex-shrink-0">–</span>
                        <input
                          type="number"
                          min={1}
                          max={pageCount}
                          value={r.to}
                          onChange={(e) => updateRange(r.id, "to", e.target.value)}
                          placeholder="To"
                          className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${err ? "border-red-500" : "border-gray-700 hover:border-gray-600"}`}
                        />
                      </div>
                      {err && <span className="text-red-400 text-xs flex-shrink-0 w-20">{err}</span>}
                      {ranges.length > 1 && (
                        <button onClick={() => removeRange(r.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={addRange}
                  className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" /> Add range
                </button>
              </div>
            )}

            {mode === "all" && (
              <div className="mb-6 bg-purple-950/30 border border-purple-800/50 rounded-xl px-4 py-3 text-sm text-purple-300">
                This will create <strong>{pageCount} separate PDF files</strong> (one per page) packed into a ZIP archive.
              </div>
            )}
          </>
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
              onClick={splitPDF}
              disabled={status === "loading"}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Splitting…</>
              ) : (
                <><Scissors className="w-5 h-5" /> Split PDF</>
              )}
            </button>

            {status === "done" && downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                {downloadName.endsWith(".zip") ? "Download ZIP" : "Download PDF"}
              </a>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm justify-center">
            <CheckCircle className="w-4 h-4" />
            Split complete! Your file is ready to download.
          </div>
        )}
      </main>
    </div>
  );
}
