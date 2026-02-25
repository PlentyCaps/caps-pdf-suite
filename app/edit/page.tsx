"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Edit3, Upload, X, Download, ArrowLeft, ChevronLeft,
  ChevronRight, Loader2, CheckCircle, MessageSquare, Type, Trash2,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ───────────────────────────────────────────── */
type AnnotKind = "text" | "comment";

interface Annotation {
  id: string;
  pageIndex: number;
  kind: AnnotKind;
  text: string;
  x: number; y: number;   // px relative to rendered page container
  color: string;          // hex
  fontSize: number;       // pt equivalent
}

interface PageInfo {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  scale: number;
  widthPt: number;
  heightPt: number;
}

/* ─── Config ──────────────────────────────────────────── */
const COLORS = [
  { hex: "#111827", label: "Black" },
  { hex: "#1d4ed8", label: "Blue" },
  { hex: "#dc2626", label: "Red" },
  { hex: "#16a34a", label: "Green" },
  { hex: "#9333ea", label: "Purple" },
];
const FONT_SIZES = [10, 12, 14, 18, 24];

/* ─── Inline text editor popup ───────────────────────────*/
function TextPopup({
  x, y, onConfirm, onCancel, kind,
}: {
  x: number; y: number;
  kind: AnnotKind;
  onConfirm: (text: string, color: string, fontSize: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(kind === "comment" ? "#1d4ed8" : "#111827");
  const [fontSize, setFontSize] = useState(12);

  return (
    <div
      className="absolute z-30 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-72"
      style={{ left: Math.min(x, 300), top: y + 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-gray-400 mb-2 font-medium">
        {kind === "comment" ? "💬 Add comment" : "T Add text"}
      </p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={kind === "comment" ? "Type your comment…" : "Type your text…"}
        rows={3}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />
      <div className="flex items-center gap-3 mb-3">
        {/* Color */}
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              title={c.label}
              onClick={() => setColor(c.hex)}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{
                background: c.hex,
                borderColor: color === c.hex ? "white" : "transparent",
              }}
            />
          ))}
        </div>
        {/* Font size */}
        <select
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => text.trim() && onConfirm(text.trim(), color, fontSize)}
          disabled={!text.trim()}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          Place
        </button>
      </div>
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────── */
export default function EditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number; kind: AnnotKind } | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotKind>("text");
  const [downloading, setDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setFileName(f.name);
    setRendering(true);
    setAnnotations([]);
    setPages([]);
    setCurrentPage(0);
    setDownloadUrl(null);
    try {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const buf = await f.arrayBuffer();
      const pdf = await getDocument({ data: buf }).promise;
      const rendered: PageInfo[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 900 / vp1.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        rendered.push({
          dataUrl: canvas.toDataURL("image/jpeg", 0.92),
          widthPx: viewport.width,
          heightPx: viewport.height,
          scale,
          widthPt: vp1.width,
          heightPt: vp1.height,
        });
      }
      setPages(rendered);
    } catch { /* ignore */ }
    setRendering(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const onPageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pending) { setPending(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPending({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      kind: activeTool,
    });
  };

  const placeAnnotation = (text: string, color: string, fontSize: number) => {
    if (!pending) return;
    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pageIndex: currentPage,
        kind: pending.kind,
        text,
        x: pending.x,
        y: pending.y,
        color,
        fontSize,
      },
    ]);
    setPending(null);
    setDownloadUrl(null);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setDownloadUrl(null);
  };

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  const downloadEdited = async () => {
    if (!file) return;
    setDownloading(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const pdfPages = pdf.getPages();

      for (const ann of annotations) {
        const pg = pdfPages[ann.pageIndex];
        const info = pages[ann.pageIndex];
        if (!pg || !info) continue;

        const xPt = ann.x / info.scale;
        const yPt = info.heightPt - (ann.y / info.scale) - ann.fontSize;
        const col = hexToRgb(ann.color);

        if (ann.kind === "comment") {
          // Draw a small label box
          const lines = ann.text.split("\n");
          const boxW = Math.max(...lines.map((l) => l.length)) * ann.fontSize * 0.55 + 12;
          const boxH = lines.length * (ann.fontSize + 3) + 8;
          pg.drawRectangle({
            x: xPt,
            y: yPt - (boxH - ann.fontSize - 4),
            width: boxW,
            height: boxH,
            color: rgb(1, 1, 0.85),
            borderColor: col,
            borderWidth: 0.8,
            opacity: 0.9,
          });
          lines.forEach((line, li) => {
            pg.drawText(line, {
              x: xPt + 6,
              y: yPt - li * (ann.fontSize + 3),
              size: ann.fontSize,
              font,
              color: col,
            });
          });
        } else {
          ann.text.split("\n").forEach((line, li) => {
            pg.drawText(line, {
              x: xPt,
              y: yPt - li * (ann.fontSize + 3),
              size: ann.fontSize,
              font,
              color: col,
            });
          });
        }
      }

      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
    }
    setDownloading(false);
  };

  const currentAnnotations = annotations.filter((a) => a.pageIndex === currentPage);
  const pg = pages[currentPage];

  // Compute display scale (container vs rendered resolution)
  const displayScale = pageRef.current && pg
    ? pageRef.current.offsetWidth / pg.widthPx
    : 1;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <Edit3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Edit PDFs</span>
          </div>

          {pages.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {/* Tool switcher */}
              <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
                <button
                  onClick={() => { setActiveTool("text"); setPending(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTool === "text" ? "bg-red-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <Type className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  onClick={() => { setActiveTool("comment"); setPending(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTool === "comment" ? "bg-red-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Comment
                </button>
              </div>

              {annotations.length > 0 && !downloadUrl && (
                <button
                  onClick={downloadEdited}
                  disabled={downloading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? "Saving…" : "Save PDF"}
                </button>
              )}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={fileName.replace(".pdf", "-edited.pdf")}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              )}
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {/* Upload */}
        {!file && !rendering && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Edit PDF Files</h1>
              <p className="text-gray-400">Add text and comments directly onto your PDF pages.</p>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${
                dragging ? "border-red-500 bg-red-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragging ? "text-red-400" : "text-gray-500"}`} />
              <p className="text-gray-300 font-medium mb-1 text-lg">
                {dragging ? "Drop your PDF here" : "Click or drag a PDF here"}
              </p>
              <p className="text-gray-500 text-sm">One PDF file at a time</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </div>
          </>
        )}

        {rendering && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-red-400 animate-spin" />
            <p className="text-gray-400">Loading PDF…</p>
          </div>
        )}

        {pages.length > 0 && !rendering && (
          <div className="flex gap-6">
            {/* Thumbnails */}
            {pages.length > 1 && (
              <div className="w-20 flex-shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[80vh]">
                {pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setCurrentPage(i); setPending(null); }}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${currentPage === i ? "border-red-500" : "border-gray-700 hover:border-gray-600"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.dataUrl} alt={`p${i + 1}`} className="w-full" />
                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1 rounded">{i + 1}</span>
                    {annotations.filter((a) => a.pageIndex === i).length > 0 && (
                      <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1">
              {/* Page bar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Page {currentPage + 1} / {pages.length}</span>
                  {currentAnnotations.length > 0 && (
                    <span className="text-xs bg-red-900/40 border border-red-800 text-red-400 px-2 py-0.5 rounded-full">
                      {currentAnnotations.length} edit{currentAnnotations.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {pages.length > 1 && (<>
                    <button onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); setPending(null); }}
                      disabled={currentPage === 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setCurrentPage((p) => Math.min(pages.length - 1, p + 1)); setPending(null); }}
                      disabled={currentPage === pages.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>)}
                  <button onClick={() => { setFile(null); setPages([]); setAnnotations([]); setDownloadUrl(null); }}
                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors ml-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Hint bar */}
              <div className="mb-2 text-xs text-gray-500 flex items-center gap-2">
                {activeTool === "text"
                  ? <><Type className="w-3.5 h-3.5 text-red-400" /> Click anywhere on the page to add text</>
                  : <><MessageSquare className="w-3.5 h-3.5 text-red-400" /> Click anywhere on the page to add a comment</>
                }
              </div>

              {/* Page + overlays */}
              <div
                ref={pageRef}
                onClick={onPageClick}
                className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700 cursor-crosshair"
                style={{ width: "100%", aspectRatio: pg ? `${pg.widthPx} / ${pg.heightPx}` : undefined }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {pg && <img src={pg.dataUrl} alt="" className="w-full h-full object-contain" draggable={false} />}

                {/* Annotations overlay */}
                {currentAnnotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="absolute group"
                    style={{ left: ann.x * displayScale, top: ann.y * displayScale }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ann.kind === "comment" ? (
                      <div
                        className="rounded-lg border px-2 py-1 text-xs max-w-[200px] whitespace-pre-wrap shadow"
                        style={{
                          background: "rgba(254,252,196,0.92)",
                          borderColor: ann.color,
                          color: ann.color,
                          fontSize: ann.fontSize * displayScale,
                          lineHeight: 1.4,
                        }}
                      >
                        {ann.text}
                      </div>
                    ) : (
                      <span
                        className="whitespace-pre-wrap leading-tight"
                        style={{ color: ann.color, fontSize: ann.fontSize * displayScale }}
                      >
                        {ann.text}
                      </span>
                    )}
                    <button
                      onClick={() => removeAnnotation(ann.id)}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}

                {/* Pending popup */}
                {pending && (
                  <TextPopup
                    x={pending.x * displayScale}
                    y={pending.y * displayScale}
                    kind={pending.kind}
                    onConfirm={placeAnnotation}
                    onCancel={() => setPending(null)}
                  />
                )}
              </div>

              {downloadUrl && (
                <div className="mt-4 flex items-center gap-2 text-green-400 text-sm justify-center">
                  <CheckCircle className="w-4 h-4" /> PDF saved — click Download above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Annotation list */}
        {annotations.length > 0 && (
          <div className="mt-8 border-t border-gray-800 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-gray-400 font-medium">All edits ({annotations.length})</h3>
              <button onClick={() => { setAnnotations([]); setDownloadUrl(null); }}
                className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3 h-3" /> Remove all
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {annotations.map((ann) => (
                <div key={ann.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                  {ann.kind === "comment"
                    ? <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ann.color }} />
                    : <Type className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ann.color }} />}
                  <span className="text-xs text-gray-400 flex-shrink-0">p.{ann.pageIndex + 1}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{ann.text}</span>
                  <button onClick={() => removeAnnotation(ann.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
