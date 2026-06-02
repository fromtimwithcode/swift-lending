"use client";

import { useState } from "react";
import { type Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Upload,
} from "lucide-react";

export type DrawFolderDraw = {
  _id: Id<"drawRequests">;
  amountRequested: number;
  workDescription: string;
  status: string;
  _creationTime: number;
  propertyAddress?: string;
};

export type DrawFolderDocument = {
  _id: string;
  fileName: string;
  type: string;
  url?: string | null;
  drawRequestId?: Id<"drawRequests">;
  propertyAddress?: string;
  entityName?: string;
};

type DrawDocumentFoldersProps = {
  draws: DrawFolderDraw[];
  documents: DrawFolderDocument[];
  title?: string;
  description?: string;
  className?: string;
  showProperty?: boolean;
  onUploadToDraw?: (draw: DrawFolderDraw) => void;
};

export function DrawDocumentFolders({
  draws,
  documents,
  title = "Draw Folders",
  description = "Keep receipts, lien waivers, and supporting files separated by draw request.",
  className,
  showProperty = false,
  onUploadToDraw,
}: DrawDocumentFoldersProps) {
  const sortedDraws = [...draws].sort((a, b) => b._creationTime - a._creationTime);
  const newestDrawId = sortedDraws[0]?._id;
  const [expandedDrawIds, setExpandedDrawIds] = useState<Set<string>>(
    () => new Set(newestDrawId ? [newestDrawId] : [])
  );

  function toggleDraw(drawId: string) {
    setExpandedDrawIds((current) => {
      const next = new Set(current);
      if (next.has(drawId)) next.delete(drawId);
      else next.add(drawId);
      return next;
    });
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card", className)}>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-balance">{title}</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground text-pretty">
            {description}
          </p>
        </div>
        {draws.length > 0 && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            <Folder className="size-3.5" />
            {draws.length} {draws.length === 1 ? "folder" : "folders"}
          </span>
        )}
      </div>

      {sortedDraws.length > 0 ? (
        <div className="divide-y divide-border">
          {sortedDraws.map((draw) => {
            const drawDocs = documents.filter((doc) => doc.drawRequestId === draw._id);
            const receiptCount = drawDocs.filter((doc) => doc.type === "receipt").length;
            const lienWaiverCount = drawDocs.filter((doc) => doc.type === "lien_waiver").length;
            const isExpanded = expandedDrawIds.has(draw._id);
            const createdAt = new Date(draw._creationTime).toLocaleDateString();

            return (
              <div key={draw._id} className="px-4 py-3 sm:px-5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDraw(draw._id)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left transition-colors hover:bg-muted/40 active:scale-[0.995]"
                  >
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {isExpanded ? <FolderOpen className="size-5" /> : <Folder className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(draw.amountRequested)} Draw
                        </span>
                        <StatusBadge status={draw.status} />
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                          <FileText className="size-3" />
                          {drawDocs.length} {drawDocs.length === 1 ? "file" : "files"}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {draw.workDescription}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{createdAt}</span>
                        {showProperty && draw.propertyAddress && <span>{draw.propertyAddress}</span>}
                        <span>{receiptCount} receipts</span>
                        <span>{lienWaiverCount} lien waivers</span>
                      </span>
                    </span>
                    <span className="mt-2 flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </span>
                  </button>

                  {onUploadToDraw && (
                    <button
                      type="button"
                      onClick={() => onUploadToDraw(draw)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition-[background-color,transform] hover:bg-muted active:scale-[0.96]"
                    >
                      <Upload className="size-3.5" />
                      Upload
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="ml-0 mt-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 sm:ml-[3.25rem]">
                    {drawDocs.length > 0 ? (
                      <div className="divide-y divide-border/70">
                        {drawDocs.map((doc) => (
                          <DocumentPreviewRow key={doc._id} document={doc} compact />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/50 px-4 py-8 text-center">
                        <FolderOpen className="size-6 text-muted-foreground/50" />
                        <p className="mt-2 text-sm font-medium">No files in this draw folder</p>
                        <p className="mt-1 max-w-sm text-xs text-muted-foreground text-pretty">
                          Upload receipts, lien waivers, and supporting documents here so this draw stays separate.
                        </p>
                        {onUploadToDraw && (
                          <button
                            type="button"
                            onClick={() => onUploadToDraw(draw)}
                            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/85 active:scale-[0.96]"
                          >
                            <Upload className="size-3.5" />
                            Upload to Folder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
            <Folder className="size-7" />
          </div>
          <p className="mt-4 text-sm font-semibold">No draw folders yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground text-pretty">
            Draw folders are created automatically as draw requests are submitted.
          </p>
        </div>
      )}
    </div>
  );
}
