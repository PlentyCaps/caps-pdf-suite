"use client";

import { useState, useRef, useCallback } from "react";
import {
  ScanText, Upload, X, Download, ArrowLeft,
  FileText, Loader2, CheckCircle, Copy, ChevronDown,
  AlertCircle, Languages,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────── */
interface PageResult {
  page: number;
  text: string;
  confidence: number;
}

type Status = "idle" | "rendering" | "ocr" | "done" | "error";

/* ─── Config ─────────────────────────────────────────────── */
const LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "nld", label: "Nederlands" },
  { code: "deu", label: "Deutsch" },
  { code: "fra", label: "Français" },
  { code: "spa", label: "Español" },
  { code: "ita", label: "Italiano" },
  { code: "por", label: "Português" },
];

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

/* ─── Page ───────────────────────────────────────────────── */
export default function OCRPage() {
  const [file, setFile]         = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [isPDF, setIsPDF]       = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lang, setLang]         = useState("eng");
  const [status, setStatus]     = useState<Status>("idle");
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults]   = useState<PageResult[]>([]);
  const [copied, setCopied]     = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Load file ── */
  const loadFile = useCallback(async (f: File) => {
    const pdf  = f.type === "application/pdf";
    const img  = f.type.startsWith("image/");
    if (!pdf && !img) return;
    setFile(f);
    setFileName(f.name);
    setFileSize(formatBytes(f.size));
    setIsPDF(pdf);
    setResults([]);
    setStatus("idle");
    setProgress(0);

    if (pdf) {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
        const buf = await f.arrayBuffer();
        const doc = await getDocument({ data: buf }).promise;
        setPageCount(doc.numPages);
      } catch {
        setPageCount(0);
      }
    } else {
      setPageCount(1);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    loadFile(e.dataTransfer.files[0]);
  }, [loadFile]);

  /* ── Run OCR ── */
  const runOCR = async () => {
    if (!file) return;
    setStatus("rendering");
    setResults([]);
    setProgress(0);
    setErrorMsg("");

    try {
      // 1. Collect page canvases
      const canvases: HTMLCanvasElement[] = [];

      if (isPDF) {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
        const buf = await file.arrayBuffer();
        const pdf = await getDocument({ data: buf }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          setCurrentStep(`Rendering page ${i} of ${pdf.numPages}…`);
          const page     = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 }); // higher res = better OCR
          const canvas   = document.createElement("canvas");
          canvas.width   = viewport.width;
          canvas.height  = viewport.height;
          await page.render({ canvas, viewport }).promise;
          canvases.push(canvas);
        }
      } else {
        // Image: draw onto canvas
        const canvas = document.createElement("canvas");
        const img    = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = URL.createObjectURL(file);
        });
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvases.push(canvas);
      }

      // 2. Create Tesseract worker
      setStatus("ocr");
      const { createWorker } = await import("tesseract.js");
      setCurrentStep(`Loading OCR engine (${LANGUAGES.find(l => l.code === lang)?.label})…`);
      const worker = await createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            // progress per page handled externally
          }
        },
      });

      // 3. OCR each page
      const pageResults: PageResult[] = [];
      for (let i = 0; i < canvases.length; i++) {
        setCurrentStep(`Recognising text on page ${i + 1} of ${canvases.length}…`);
        setProgress(Math.round((i / canvases.length) * 100));

        const dataUrl = canvases[i].toDataURL("image/png");
        const { data } = await worker.recognize(dataUrl);
        pageResults.push({
          page: i + 1,
          text: data.text.trim(),
          confidence: Math.round(data.confidence),
        });
        setResults([...pageResults]);
      }

      await worker.terminate();
      setProgress(100);
      setCurrentStep("");
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("OCR failed. Check your internet connection (language data is downloaded on first use).");
      setStatus("error");
    }
  };

  /* ── Downloads ── */
  const fullText = results.map((r) =>
    results.length > 1 ? `=== Page ${r.page} ===\n${r.text}` : r.text
  ).join("\n\n");

  const downloadTxt = () => {
    const blob = new Blob([fullText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, "") + "-ocr.txt";
    a.click();
  };

  const downloadDocx = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
    const children = [];
    for (const r of results) {
      if (results.length > 1) {
        children.push(new Paragraph({ text: `Page ${r.page}`, heading: HeadingLevel.HEADING_2 }));
      }
      for (const line of r.text.split("\n")) {
        children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22 })] }));
      }
    }
    const doc = new Document({ sections: [{ children }] });
    const buf = await Packer.toBuffer(doc);
    const blob = new Blob([new Uint8Array(buf)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, "") + "-ocr.docx";
    a.click();
  };

  const copyAll = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFile(null);
    setResults([]);
    setStatus("idle");
    setProgress(0);
  };

  const running = status === "rendering" || status === "ocr";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
              <ScanText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">OCR — Text Recognition</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">OCR Text Recognition</h1>
          <p className="text-gray-400">
            Extract text from scanned PDFs and images — runs entirely in your browser.
          </p>
        </div>

        {/* Drop zone */}
        {!file && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 mb-6 ${
              dragging ? "border-violet-500 bg-violet-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-violet-400" : "text-gray-500"}`} />
            <p className="text-gray-300 font-medium mb-1">
              {dragging ? "Drop file here" : "Click or drag a file here"}
            </p>
            <p className="text-gray-500 text-sm">PDF, PNG, JPG supported</p>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/jpg"
              className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </div>
        )}

        {/* File card + settings */}
        {file && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 space-y-5">
            {/* File info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fileName}</p>
                <p className="text-sm text-gray-500">
                  {fileSize}
                  {isPDF && pageCount > 0 && ` · ${pageCount} page${pageCount !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button onClick={reset} className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language selector */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
                <Languages className="w-4 h-4" /> Document language
              </label>
              <div className="relative">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  disabled={running}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 cursor-pointer pr-10"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Language data is downloaded on first use (~5 MB per language).
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
              <p className="text-sm text-gray-300">{currentStep}</p>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {results.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {results.length} of {pageCount} page{pageCount !== 1 ? "s" : ""} done
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mb-6 flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMsg}
          </div>
        )}

        {/* Action button */}
        {file && (
          <button
            onClick={runOCR}
            disabled={running}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed mb-8"
          >
            {running
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Running OCR…</>
              : <><ScanText className="w-5 h-5" /> Start OCR</>}
          </button>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            {/* Download / copy bar */}
            {status === "done" && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2 text-green-400 text-sm mr-auto">
                  <CheckCircle className="w-4 h-4" />
                  OCR complete — {results.length} page{results.length !== 1 ? "s" : ""} recognised
                </div>
                <button onClick={copyAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Copied!" : "Copy all"}
                </button>
                <button onClick={downloadTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm transition-colors">
                  <Download className="w-3.5 h-3.5" /> .txt
                </button>
                <button onClick={downloadDocx}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" /> .docx
                </button>
              </div>
            )}

            {/* Page results */}
            <div className="space-y-4">
              {results.map((r) => (
                <div key={r.page} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* Page header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/80">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-300">
                        {results.length > 1 ? `Page ${r.page}` : fileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        r.confidence >= 80
                          ? "bg-green-950/50 border-green-800 text-green-400"
                          : r.confidence >= 50
                          ? "bg-yellow-950/50 border-yellow-800 text-yellow-400"
                          : "bg-red-950/50 border-red-800 text-red-400"
                      }`}>
                        {r.confidence}% confidence
                      </span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(r.text); }}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title="Copy this page"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Text output */}
                  <pre className="px-4 py-4 text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-72 overflow-y-auto">
                    {r.text || <span className="text-gray-600 italic">No text detected on this page</span>}
                  </pre>
                </div>
              ))}
            </div>

            {/* Still processing */}
            {running && results.length < pageCount && (
              <div className="mt-4 flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing remaining pages…
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
