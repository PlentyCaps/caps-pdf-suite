"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import {
  PenTool, Upload, X, Download, ArrowLeft, ChevronLeft,
  ChevronRight, Loader2, CheckCircle, AlertCircle, Type,
  Trash2, RotateCcw, Plus,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
interface PageInfo {
  dataUrl: string;      // rendered page as image
  widthPx: number;
  heightPx: number;
  scale: number;        // px / pt ratio used when rendering
  widthPt: number;      // original PDF points
  heightPt: number;
}

interface Placement {
  id: string;
  pageIndex: number;
  x: number; y: number;          // top-left in px relative to page container
  width: number; height: number; // in px
  dataUrl: string;
}

type SignMode = "draw" | "type";
type Status = "idle" | "rendering" | "done" | "error";

/* ─── Signature Pad ─────────────────────────────────────── */
function SignaturePad({
  onConfirm, onCancel,
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<SignMode>("draw");
  const [typed, setTyped] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setIsEmpty(true);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current; if (!c) return;
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e, c);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const c = canvasRef.current; if (!c) return;
    e.preventDefault();
    const ctx = c.getContext("2d")!;
    const pos = getPos(e, c);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1e40af";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    lastPos.current = pos;
  };

  const stopDraw = () => { setDrawing(false); lastPos.current = null; };

  // Render typed signature to canvas
  useEffect(() => {
    if (mode !== "type") return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!typed) { setIsEmpty(true); return; }
    setIsEmpty(false);
    const fontSize = 52;
    ctx.font = `${fontSize}px "Dancing Script", cursive`;
    ctx.fillStyle = "#1e40af";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typed, c.width / 2, c.height / 2);
  }, [typed, mode]);

  const confirm = () => {
    const c = canvasRef.current; if (!c) return;
    onConfirm(c.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Load Google Font */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap');`}</style>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-lg">Create Signature</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(["draw", "type"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); clearCanvas(); setTyped(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}
            >
              {m === "draw" ? <PenTool className="w-4 h-4" /> : <Type className="w-4 h-4" />}
              {m === "draw" ? "Draw" : "Type"}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="px-6 py-4">
          <div className="relative border border-gray-700 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={480}
              height={160}
              className="w-full touch-none cursor-crosshair select-none"
              style={{ display: mode === "type" ? "block" : "block" }}
              onMouseDown={mode === "draw" ? startDraw : undefined}
              onMouseMove={mode === "draw" ? draw : undefined}
              onMouseUp={mode === "draw" ? stopDraw : undefined}
              onMouseLeave={mode === "draw" ? stopDraw : undefined}
              onTouchStart={mode === "draw" ? startDraw : undefined}
              onTouchMove={mode === "draw" ? draw : undefined}
              onTouchEnd={mode === "draw" ? stopDraw : undefined}
            />
            {mode === "draw" && isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-gray-300 text-sm">Draw your signature here</span>
              </div>
            )}
          </div>

          {mode === "type" && (
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your name…"
              className="mt-3 w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          )}

          <p className="text-xs text-gray-500 mt-2">
            {mode === "draw"
              ? "Use your mouse or finger to draw your signature."
              : "Your name will be rendered in a handwriting style."}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          {mode === "draw" ? (
            <button onClick={clearCanvas} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              <RotateCcw className="w-4 h-4" /> Clear
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={isEmpty}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
            >
              Use Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────── */
export default function SignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | null>(null); // dataUrl waiting to be placed
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [draggingPlacement, setDraggingPlacement] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [downloading, setDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setFileName(f.name);
    setStatus("rendering");
    setPages([]);
    setPlacements([]);
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
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvas, viewport }).promise;
        rendered.push({
          dataUrl: canvas.toDataURL("image/jpeg", 0.92),
          widthPx: viewport.width,
          heightPx: viewport.height,
          scale: 1.5,
          widthPt: page.getViewport({ scale: 1 }).width,
          heightPt: page.getViewport({ scale: 1 }).height,
        });
      }

      setPages(rendered);
      setStatus("idle");
    } catch {
      setErrorMsg("Failed to render the PDF. Make sure it's a valid file.");
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  const reset = () => {
    setFile(null);
    setPages([]);
    setPlacements([]);
    setStatus("idle");
    setDownloadUrl(null);
    setPendingSig(null);
  };

  // Place signature on click
  const onPageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pendingSig) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const sigW = 180, sigH = 60;
    setPlacements((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        pageIndex: currentPage,
        x: x - sigW / 2,
        y: y - sigH / 2,
        width: sigW,
        height: sigH,
        dataUrl: pendingSig,
      },
    ]);
    setPendingSig(null);
  };

  // Drag placements
  const startDragPlacement = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const placement = placements.find((p) => p.id === id)!;
    setDraggingPlacement(id);
    setDragOffset({ x: e.clientX - placement.x, y: e.clientY - placement.y });
  };

  useEffect(() => {
    if (!draggingPlacement) return;
    const onMove = (e: MouseEvent) => {
      const container = pageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === draggingPlacement
            ? {
                ...p,
                x: Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x + p.x, rect.width - p.width)),
                y: Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y + p.y, rect.height - p.height)),
              }
            : p
        )
      );
    };
    const onUp = () => setDraggingPlacement(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingPlacement]);

  const downloadSigned = async () => {
    if (!file || placements.length === 0) return;
    setDownloading(true);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf);
      const pdfPages = pdf.getPages();

      // Group placements by page
      for (const placement of placements) {
        const pg = pdfPages[placement.pageIndex];
        const pageInfo = pages[placement.pageIndex];
        if (!pg || !pageInfo) continue;

        // Convert PNG dataUrl to bytes
        const res = await fetch(placement.dataUrl);
        const imgBuf = await res.arrayBuffer();
        const pngImg = await pdf.embedPng(imgBuf);

        // Convert px → pt
        const xPt = placement.x / pageInfo.scale;
        const widthPt = placement.width / pageInfo.scale;
        const heightPt = placement.height / pageInfo.scale;
        const yPt = pageInfo.heightPt - (placement.y / pageInfo.scale) - heightPt;

        pg.drawImage(pngImg, {
          x: xPt,
          y: yPt,
          width: widthPt,
          height: heightPt,
          opacity: 1,
        });
      }

      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to embed signature. Please try again.");
    }
    setDownloading(false);
  };

  const pagePlacements = placements.filter((p) => p.pageIndex === currentPage);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {showPad && (
        <SignaturePad
          onConfirm={(dataUrl) => { setPendingSig(dataUrl); setShowPad(false); }}
          onCancel={() => setShowPad(false)}
        />
      )}

      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
              <PenTool className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Sign PDFs</span>
          </div>
          {file && pages.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {pendingSig && (
                <span className="text-xs bg-teal-900/50 border border-teal-700 text-teal-300 px-3 py-1.5 rounded-lg animate-pulse">
                  Click on the page to place signature
                </span>
              )}
              <button
                onClick={() => setShowPad(true)}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Signature
              </button>
              {placements.length > 0 && !downloadUrl && (
                <button
                  onClick={downloadSigned}
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
                  download={fileName.replace(".pdf", "-signed.pdf")}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" /> Download signed PDF
                </a>
              )}
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {/* Upload state */}
        {!file && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Sign PDF Files</h1>
              <p className="text-gray-400">Draw or type your signature, then place it anywhere on your document.</p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${
                dragging ? "border-teal-500 bg-teal-500/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragging ? "text-teal-400" : "text-gray-500"}`} />
              <p className="text-gray-300 font-medium mb-1 text-lg">
                {dragging ? "Drop your PDF here" : "Click or drag a PDF here"}
              </p>
              <p className="text-gray-500 text-sm">One PDF file at a time</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </div>
          </>
        )}

        {/* Rendering state */}
        {status === "rendering" && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
            <p className="text-gray-400">Rendering PDF pages…</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm mt-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{errorMsg}
          </div>
        )}

        {/* PDF viewer */}
        {pages.length > 0 && status !== "rendering" && (
          <div className="flex gap-6">
            {/* Thumbnails sidebar */}
            {pages.length > 1 && (
              <div className="w-24 flex-shrink-0 flex flex-col gap-2 overflow-y-auto max-h-[80vh]">
                {pages.map((pg, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      currentPage === i ? "border-teal-500" : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pg.dataUrl} alt={`Page ${i + 1}`} className="w-full" />
                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1 rounded">
                      {i + 1}
                    </span>
                    {placements.filter((p) => p.pageIndex === i).length > 0 && (
                      <span className="absolute top-1 right-1 w-3 h-3 bg-teal-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Main page view */}
            <div className="flex-1">
              {/* Page info bar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Page {currentPage + 1} of {pages.length}
                  </span>
                  {placements.filter(p => p.pageIndex === currentPage).length > 0 && (
                    <span className="text-xs bg-teal-900/50 border border-teal-700 text-teal-300 px-2 py-0.5 rounded-full">
                      {placements.filter(p => p.pageIndex === currentPage).length} signature{placements.filter(p => p.pageIndex === currentPage).length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pages.length > 1 && (
                    <>
                      <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                        disabled={currentPage === pages.length - 1}
                        className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button onClick={reset} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Page canvas with signature overlays */}
              <div
                ref={pageContainerRef}
                onClick={onPageClick}
                className={`relative rounded-xl overflow-hidden shadow-2xl border border-gray-700 ${
                  pendingSig ? "cursor-crosshair ring-2 ring-teal-500/50" : "cursor-default"
                }`}
                style={{ width: "100%", aspectRatio: `${pages[currentPage].widthPx} / ${pages[currentPage].heightPx}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pages[currentPage].dataUrl}
                  alt={`Page ${currentPage + 1}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />

                {/* Signature overlays for current page */}
                {pagePlacements.map((p) => {
                  // Scale placements to current container width
                  const containerW = pageContainerRef.current?.offsetWidth ?? pages[currentPage].widthPx;
                  const displayScale = containerW / pages[currentPage].widthPx;
                  return (
                    <div
                      key={p.id}
                      onMouseDown={(e) => startDragPlacement(e, p.id)}
                      className="absolute cursor-move select-none group"
                      style={{
                        left: p.x * displayScale,
                        top: p.y * displayScale,
                        width: p.width * displayScale,
                        height: p.height * displayScale,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt="signature" className="w-full h-full object-contain" draggable={false} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlacements((prev) => prev.filter((pl) => pl.id !== p.id)); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Hints */}
              {!pendingSig && placements.length === 0 && (
                <p className="text-center text-gray-500 text-sm mt-4">
                  Click <strong className="text-gray-400">Add Signature</strong> to create and place your signature.
                </p>
              )}
              {pendingSig && (
                <p className="text-center text-teal-400 text-sm mt-4 animate-pulse">
                  👆 Click anywhere on the page to place your signature
                </p>
              )}
              {downloadUrl && (
                <div className="mt-4 flex items-center justify-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Signature embedded! Download your signed PDF above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Placements list */}
        {placements.length > 0 && (
          <div className="mt-8 border-t border-gray-800 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Placed signatures ({placements.length})</h3>
              <button
                onClick={() => setPlacements([])}
                className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Remove all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {placements.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="sig" className="h-6 w-16 object-contain" />
                  <span className="text-xs text-gray-500">Page {p.pageIndex + 1}</span>
                  <button onClick={() => setPlacements((prev) => prev.filter((pl) => pl.id !== p.id))}
                    className="text-gray-600 hover:text-red-400 transition-colors ml-1">
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
