"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import {
  Archive, Upload, X, Download, ArrowLeft,
  FileText, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";
import Link from "next/link";

/* ─── Helpers ──────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

const PRESETS = [
  { label: "High quality", quality: 85, desc: "Best looking, larger file" },
  { label: "Balanced",     quality: 60, desc: "Good quality, noticeably smaller" },
  { label: "Small size",   quality: 35, desc: "Smallest file, lower quality" },
] as const;

type Status = "idle" | "compressing" | "done" | "error";

/* ─── Page ─────────────────────────────────────────────── */
export default function CompressPage() {
  const [file, setFile]           = useState<File | null>(null);
  const [fileName, setFileName]   = useState("");
  const [origSize, setOrigSize]   = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [dragging, setDragging]   = useState(false);
  const [quality, setQuality]     = useState(60);
  const [status, setStatus]       = useState<Status>("idle");
  const [progress, setProgress]   = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [errorMsg, setErrorMsg]   = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") return;
    try {
      const buf = await f.arrayBuffer();
      const pdf = await PDFDocument.load(buf);
      setFile(f);
      setFileName(f.name);
      setOrigSize(f.size);
      setPageCount(pdf.getPageCount());
      setStatus("idle");
      setResultUrl(null);
    } catch {
      setErrorMsg("Could not read this PDF.");
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const compress = async () => {
    if (!file) return;
    setStatus("compressing");
    setProgress(0);
    setErrorMsg("");
    setResultUrl(null);

    try {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

      const buf = await file.arrayBuffer();
      const pdf = await getDocument({ data: buf }).promise;
      const outDoc = await PDFDocument.create();

      // Render scale: lower quality → lower resolution
      const renderScale = quality >= 70 ? 1.5 : quality >= 45 ? 1.2 : 0.9;
      const jpegQuality = quality / 100;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvas, viewport }).promise;

        const dataUrl  = canvas.toDataURL("image/jpeg", jpegQuality);
        const response = await fetch(dataUrl);
        const jpegBuf  = await response.arrayBuffer();
        const img      = await outDoc.embedJpg(new Uint8Array(jpegBuf));
        const pg       = outDoc.addPage([viewport.width, viewport.height]);
        pg.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });

        setProgress(Math.round((i / pdf.numPages) * 100));
      }

      const bytes = await outDoc.save();
      const blob  = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setResultUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("Compression failed. Please try another file.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setOrigSize(0);
    setPageCount(0);
    setStatus("idle");
    setResultUrl(null);
  };

  const saving  = origSize > 0 && resultSize > 0 ? origSize - resultSize : 0;
  const pctSaved = origSize > 0 ? Math.round((saving / origSize) * 100) : 0;

  // Quality label
  const qualityLabel =
    quality >= 80 ? "High quality" :
    quality >= 55 ? "Balanced" :
    quality >= 35 ? "Small size" : "Maximum compression";

  const qualityColor =
    quality >= 80 ? "text-green-400" :
    quality >= 55 ? "text-yellow-400" :
    quality >= 35 ? "text-orange-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Archive className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Compress PDFs</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Compress PDF Files</h1>
          <p className="text-gray-400">
            Choose your quality level and reduce your PDF&apos;s file size instantly.
          </p>
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragging ? "border-orange-500 bg-orange-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-orange-400" : "text-gray-500"}`} />
            <p className="text-gray-300 font-medium mb-1">
              {dragging ? "Drop your PDF here" : "Click or drag a PDF here"}
            </p>
            <p className="text-gray-500 text-sm">One PDF file at a time</p>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </div>
        ) : (
          /* File card */
          <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-6">
            <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{fileName}</p>
              <p className="text-sm text-gray-500">{formatBytes(origSize)} · {pageCount} page{pageCount !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={reset} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quality controls */}
        {file && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            {/* Preset buttons */}
            <p className="text-sm font-medium text-gray-400 mb-3">Quick presets</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setQuality(p.quality)}
                  className={`flex flex-col items-center p-3 rounded-xl border text-sm transition-all ${
                    quality === p.quality
                      ? "border-orange-500 bg-orange-950/40 text-orange-300"
                      : "border-gray-700 hover:border-gray-600 text-gray-400"
                  }`}
                >
                  <span className="font-medium mb-0.5">{p.label}</span>
                  <span className="text-xs opacity-70">{p.desc}</span>
                </button>
              ))}
            </div>

            {/* Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-400">Quality</p>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${qualityColor}`}>{qualityLabel}</span>
                  <span className="text-sm text-gray-500">({quality}%)</span>
                </div>
              </div>

              <input
                type="range"
                min={10}
                max={95}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer h-2 rounded-lg"
              />

              <div className="flex justify-between text-xs text-gray-600">
                <span>Max compression</span>
                <span>Best quality</span>
              </div>
            </div>

            {/* Info note */}
            <div className="mt-4 flex items-start gap-2 bg-gray-800/50 rounded-xl px-3 py-2.5 text-xs text-gray-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-500" />
              Pages are rendered as compressed images. Text won&apos;t be selectable after compression.
            </div>
          </div>
        )}

        {/* Progress bar */}
        {status === "compressing" && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> Compressing page {Math.ceil(progress * pageCount / 100)} of {pageCount}…
              </span>
              <span className="text-orange-400 font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result stats */}
        {status === "done" && resultSize > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: "Original", value: formatBytes(origSize), sub: "" },
              { label: "Compressed", value: formatBytes(resultSize), sub: "" },
              {
                label: "Saved",
                value: pctSaved > 0 ? `${pctSaved}%` : "~0%",
                sub: pctSaved > 0 ? formatBytes(saving) : "",
                highlight: true,
              },
            ].map((s) => (
              <div key={s.label}
                className={`rounded-xl border p-4 text-center ${
                  s.highlight ? "border-green-700 bg-green-950/30" : "border-gray-800 bg-gray-900"
                }`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.highlight ? "text-green-400" : "text-gray-100"}`}>{s.value}</p>
                {s.sub && <p className="text-xs text-gray-500 mt-0.5">{s.sub} smaller</p>}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mb-6 flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMsg}
          </div>
        )}

        {/* Action buttons */}
        {file && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={compress}
              disabled={status === "compressing"}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "compressing"
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Compressing…</>
                : <><Archive className="w-5 h-5" /> Compress at {quality}% quality</>}
            </button>

            {status === "done" && resultUrl && (
              <a
                href={resultUrl}
                download={fileName.replace(".pdf", "-compressed.pdf")}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors"
              >
                <Download className="w-5 h-5" /> Download
              </a>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm justify-center">
            <CheckCircle className="w-4 h-4" />
            Done! Your compressed PDF is ready.
          </div>
        )}
      </main>
    </div>
  );
}
