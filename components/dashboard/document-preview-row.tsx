"use client";

/* eslint-disable @next/next/no-img-element -- Convex storage URLs are signed runtime URLs, so native images avoid Next remote allowlist churn. */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  ImageIcon,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";

export type PreviewDocument = {
  _id: string;
  fileName: string;
  type: string;
  url?: string | null;
  propertyAddress?: string;
  entityName?: string;
  drawWorkDescription?: string;
};

type DocumentPreviewRowProps = {
  document: PreviewDocument;
  previewDocuments?: readonly PreviewDocument[];
  compact?: boolean;
  children?: ReactNode;
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export function isPreviewableImage(document: Pick<PreviewDocument, "fileName" | "type">) {
  const fileName = document.fileName.toLowerCase();
  return document.type === "property_photo" || IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

export function DocumentPreviewRow({
  document,
  previewDocuments,
  compact = false,
  children,
}: DocumentPreviewRowProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isImage = Boolean(document.url) && isPreviewableImage(document);
  const galleryDocuments = useMemo(
    () => (previewDocuments ?? [document]).filter(
      (item) => Boolean(item.url) && isPreviewableImage(item)
    ),
    [document, previewDocuments]
  );
  const activeDocument = galleryDocuments[previewIndex] ?? document;
  const hasPrevious = previewIndex > 0;
  const hasNext = previewIndex < galleryDocuments.length - 1;
  const thumbnailSize = compact ? "size-10" : "h-16 w-24 sm:h-20 sm:w-28";

  const openPreview = () => {
    previousFocusRef.current = globalThis.document.activeElement as HTMLElement | null;
    const initialIndex = galleryDocuments.findIndex((item) => item._id === document._id);
    setPreviewIndex(Math.max(0, initialIndex));
    setPreviewOpen(true);
  };

  const closePreview = () => setPreviewOpen(false);

  useEffect(() => {
    if (!previewOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
        return;
      }

      if (galleryDocuments.length > 1) {
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          setPreviewIndex((current) => Math.max(0, current - 1));
          return;
        }
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          setPreviewIndex((current) => Math.min(galleryDocuments.length - 1, current + 1));
          return;
        }
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && globalThis.document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && globalThis.document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const previousOverflow = documentBodyOverflow();
    globalThis.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [galleryDocuments.length, previewOpen]);

  return (
    <>
      <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {isImage ? (
            <button
              type="button"
              onClick={openPreview}
              aria-label={`Preview ${document.fileName}`}
              className={`${thumbnailSize} group relative shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-sm ring-offset-background transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-ring/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              <img
                src={document.url ?? undefined}
                alt=""
                className="image-outline h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                <span className="scale-90 rounded-full bg-white/90 p-2 text-gray-900 opacity-0 shadow-sm transition-[opacity,scale,transform] group-hover:scale-100 group-hover:opacity-100">
                  <Eye className="size-4" />
                </span>
              </span>
            </button>
          ) : (
            <div className={`${thumbnailSize} flex shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground`}>
              <FileText className={compact ? "size-4" : "size-6"} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{document.fileName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={document.type} />
              {isImage && (
                <button
                  type="button"
                  onClick={openPreview}
                  className="inline-flex min-h-10 items-center gap-1 rounded-full bg-primary/10 px-3 text-[11px] font-medium text-primary transition-[background-color,transform] hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
                >
                  <ImageIcon className="size-3" />
                  Preview
                </button>
              )}
              {(document.propertyAddress || document.entityName) && (
                <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                  {[document.propertyAddress, document.entityName].filter(Boolean).join(" / ")}
                </span>
              )}
              {!compact && document.drawWorkDescription && (
                <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                  Draw: {document.drawWorkDescription}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 self-end sm:self-auto">
          {document.url && isImage && (
            <button
              type="button"
              onClick={openPreview}
              className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              aria-label={`Preview ${document.fileName}`}
            >
              <Eye className="size-4" />
            </button>
          )}
          {document.url && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              download={document.fileName}
              className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              aria-label={isImage ? `Download ${document.fileName}` : `Open ${document.fileName}`}
            >
              {isImage ? <Download className="size-4" /> : <ExternalLink className="size-4" />}
            </a>
          )}
          {children}
        </div>
      </div>

      {isImage && previewOpen && document.url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <div
            ref={dialogRef}
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-sm font-semibold sm:text-base">
                  {activeDocument.fileName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={activeDocument.type} />
                  {galleryDocuments.length > 1 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {previewIndex + 1} of {galleryDocuments.length} · Use arrow keys
                    </span>
                  )}
                  {(activeDocument.propertyAddress || activeDocument.entityName) && (
                    <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                      {[activeDocument.propertyAddress, activeDocument.entityName].filter(Boolean).join(" / ")}
                    </span>
                  )}
                  {activeDocument.drawWorkDescription && (
                    <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">
                      Draw: {activeDocument.drawWorkDescription}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={activeDocument.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={activeDocument.fileName}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  aria-label={`Download ${activeDocument.fileName}`}
                >
                  <Download className="size-4" />
                </a>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closePreview}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  aria-label="Close preview"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/95 p-2 sm:p-4">
              {galleryDocuments.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex((current) => Math.max(0, current - 1))}
                  disabled={!hasPrevious}
                  className="absolute left-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-[background-color,transform] hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30 sm:left-4"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <img
                src={activeDocument.url ?? undefined}
                alt={activeDocument.fileName}
                className="image-outline max-h-[78dvh] max-w-full rounded-lg object-contain shadow-2xl"
              />
              {galleryDocuments.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex((current) => Math.min(galleryDocuments.length - 1, current + 1))}
                  disabled={!hasNext}
                  className="absolute right-2 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-[background-color,transform] hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30 sm:right-4"
                  aria-label="Next image"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function documentBodyOverflow() {
  return globalThis.document.body.style.overflow;
}
