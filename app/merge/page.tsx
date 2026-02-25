"use client";

import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import {
  FileText,
  Upload,
  X,
  GripVertical,
  Download,
  ArrowLeft,
  CheckCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: string;
  pages?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function MergePage() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<string | null>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const pdfs = newFiles.filter((f) => f.type === "application/pdf");
    const entries: PDFFile[] = await Promise.all(
      pdfs.map(async (file) => {
        let pages: number | undefined;
        try {
          const buf = await file.arrayBuffer();
          const doc = await PDFDocument.load(buf);
          pages = doc.getPageCount();
        } catch {
          pages = undefined;
        }
        return {
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: formatBytes(file.size),
          pages,
        };
      })
    );
    setFiles((prev) => [...prev, ...entries]);
    setStatus("idle");
    setDownloadUrl(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setStatus("idle");
    setDownloadUrl(null);
  };

  // Drag-to-reorder
  const onItemDragStart = (id: string) => {
    dragItem.current = id;
  };
  const onItemDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const onItemDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragItem.current || dragItem.current === targetId) return;
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.id === dragItem.current);
      const to = prev.findIndex((f) => f.id === targetId);
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
    dragItem.current = null;
  };

  const mergePDFs = async () => {
    if (files.length < 2) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const merged = await PDFDocument.create();
      for (const entry of files) {
        const buf = await entry.file.arrayBuffer();
        const doc = await PDFDocument.load(buf);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg("Something went wrong while merging. Make sure all files are valid PDFs.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="w-px h-5 bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold">Merge PDFs</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Merge PDF Files</h1>
          <p className="text-gray-400">
            Upload your PDFs, drag to reorder, then merge into one file.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
            dragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
          }`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-3 transition-colors ${dragging ? "text-blue-400" : "text-gray-500"}`} />
          <p className="text-gray-300 font-medium mb-1">
            {dragging ? "Drop your PDFs here" : "Click or drag PDFs here"}
          </p>
          <p className="text-gray-500 text-sm">Only PDF files are accepted</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400 font-medium">
                {files.length} file{files.length !== 1 ? "s" : ""} · drag to reorder
              </p>
              <button
                onClick={() => { setFiles([]); setStatus("idle"); setDownloadUrl(null); }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            {files.map((f, index) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => onItemDragStart(f.id)}
                onDragOver={(e) => onItemDragOver(e, f.id)}
                onDrop={(e) => onItemDrop(e, f.id)}
                onDragEnd={() => setDragOverId(null)}
                className={`flex items-center gap-3 bg-gray-900 border rounded-xl px-4 py-3 transition-all duration-150 ${
                  dragOverId === f.id
                    ? "border-blue-500 bg-blue-950/30"
                    : "border-gray-800 hover:border-gray-700"
                }`}
              >
                <GripVertical className="w-4 h-4 text-gray-600 cursor-grab flex-shrink-0" />
                <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-xs font-bold">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-gray-500">
                    {f.size}{f.pages !== undefined ? ` · ${f.pages} page${f.pages !== 1 ? "s" : ""}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(f.id)}
                  className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mb-6 bg-red-950/50 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={mergePDFs}
            disabled={files.length < 2 || status === "loading"}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Merging…</>
            ) : (
              <><FileText className="w-5 h-5" /> Merge {files.length >= 2 ? `${files.length} PDFs` : "PDFs"}</>
            )}
          </button>

          {status === "done" && downloadUrl && (
            <a
              href={downloadUrl}
              download="merged.pdf"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3.5 rounded-xl font-semibold transition-colors"
            >
              <Download className="w-5 h-5" /> Download merged PDF
            </a>
          )}
        </div>

        {status === "done" && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm justify-center">
            <CheckCircle className="w-4 h-4" />
            Merge complete! Your PDF is ready to download.
          </div>
        )}

        {files.length < 2 && files.length > 0 && (
          <p className="text-center text-gray-500 text-sm mt-4">
            Add at least one more PDF to merge.
          </p>
        )}

        {files.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-4">
            Add 2 or more PDFs to get started.
          </p>
        )}
      </main>
    </div>
  );
}
