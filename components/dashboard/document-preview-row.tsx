"use client";

/* eslint-disable @next/next/no-img-element -- Convex storage URLs are signed runtime URLs, so native images avoid Next remote allowlist churn. */

import { useEffect, useId, useState, type ReactNode } from "react";
import { Download, ExternalLink, Eye, FileText, ImageIcon, X } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";

type PreviewDocument = {
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
  compact?: boolean;
  children?: ReactNode;
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export function isPreviewableImage(document: Pick<PreviewDocument, "fileName" | "type">) {
  const fileName = document.fileName.toLowerCase();
  return document.type === "property_photo" || IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

export function DocumentPreviewRow({ document, compact = false, children }: DocumentPreviewRowProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const titleId = useId();
  const isImage = Boolean(document.url) && isPreviewableImage(document);
  const thumbnailSize = compact ? "size-10" : "h-16 w-24 sm:h-20 sm:w-28";

  useEffect(() => {
    if (!previewOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };

    const previousOverflow = documentBodyOverflow();
    globalThis.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewOpen]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {isImage ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
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

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{document.fileName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={document.type} />
              {isImage && (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition hover:bg-primary/15"
                >
                  <ImageIcon className="size-3" />
                  Preview
                </button>
              )}
              {(document.propertyAddress || document.entityName) && (
                <span className="truncate text-xs text-muted-foreground">
                  {[document.propertyAddress, document.entityName].filter(Boolean).join(" / ")}
                </span>
              )}
              {!compact && document.drawWorkDescription && (
                <span className="truncate text-xs text-muted-foreground">
                  Draw: {document.drawWorkDescription}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {document.url && isImage && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-sm font-semibold sm:text-base">
                  {document.fileName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={document.type} />
                  {(document.propertyAddress || document.entityName) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {[document.propertyAddress, document.entityName].filter(Boolean).join(" / ")}
                    </span>
                  )}
                  {document.drawWorkDescription && (
                    <span className="truncate text-xs text-muted-foreground">
                      Draw: {document.drawWorkDescription}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={document.fileName}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`Download ${document.fileName}`}
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close preview"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-black/95 p-2 sm:p-4">
              <img
                src={document.url}
                alt={document.fileName}
                className="image-outline max-h-[78dvh] max-w-full rounded-lg object-contain shadow-2xl"
              />
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
