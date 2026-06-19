"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { DOC_TYPE_LABELS, MAX_FILE_SIZE_BYTES } from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatFileSize } from "@/lib/format";
import {
  CheckCircle2,
  Circle,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";

type DocType =
  | "articles"
  | "operating_agreement"
  | "closing_statement"
  | "wire_instructions"
  | "property_photo"
  | "receipt"
  | "lien_waiver"
  | "rehab_budget"
  | "other";

interface DocumentChecklistProps {
  loanId: Id<"loans">;
  isRepeatEntity: boolean;
}

interface DocRow {
  label: string;
  types: DocType[];
  multi: boolean;
  required: boolean;
  accept?: string;
  note?: string;
}

interface UploadProgress {
  current: number;
  total: number;
}

const MAX_UPLOAD_BATCH_FILES = 50;

export function DocumentChecklist({
  loanId,
  isRepeatEntity,
}: DocumentChecklistProps) {
  const documents = useQuery(api.documents.getDocumentsForLoan, { loanId });
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocuments = useMutation(api.documents.saveDocuments);
  const discardUnsavedUploads = useMutation(api.documents.discardUnsavedUploads);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [uploadingRow, setUploadingRow] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");
  const [articleSubType, setArticleSubType] = useState<"articles" | "operating_agreement">("articles");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const requiredRows: DocRow[] = [
    {
      label: "Rehab Breakdown",
      types: ["rehab_budget"],
      multi: false,
      required: true,
    },
    {
      label: "Property Pictures",
      types: ["property_photo"],
      multi: true,
      required: true,
      accept: ".png,.jpg,.jpeg,.webp",
    },
    ...(isRepeatEntity
      ? []
      : [
          {
            label: "Articles / OA",
            types: ["articles", "operating_agreement"] as DocType[],
            multi: true,
            required: true,
          },
        ]),
  ];

  const additionalRows: DocRow[] = [
    ...(isRepeatEntity
      ? [
          {
            label: "Articles / OA",
            types: ["articles", "operating_agreement"] as DocType[],
            multi: true,
            required: false,
            note: "Optional — same entity as another loan",
          },
        ]
      : []),
    { label: "Closing Statement", types: ["closing_statement"] as DocType[], multi: false, required: false },
    { label: "Wire Instructions", types: ["wire_instructions"] as DocType[], multi: false, required: false },
    { label: "Receipts", types: ["receipt"] as DocType[], multi: true, required: false },
    { label: "Lien Waivers", types: ["lien_waiver"] as DocType[], multi: true, required: false },
    { label: "Other", types: ["other"] as DocType[], multi: true, required: false },
  ];

  function getDocsForRow(row: DocRow) {
    if (!documents) return [];
    return documents.filter((d) => !d.drawRequestId && row.types.includes(d.type as DocType));
  }

  function toggleExpanded(label: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleUpload(row: DocRow, files: FileList) {
    setError("");
    setUploadingRow(row.label);

    const fileArray = Array.from(files);
    if (fileArray.length > MAX_UPLOAD_BATCH_FILES) {
      setError(`Select up to ${MAX_UPLOAD_BATCH_FILES} files at a time.`);
      setUploadingRow(null);
      const input = fileInputRefs.current[row.label];
      if (input) input.value = "";
      return;
    }

    const skipped: string[] = [];
    const uploadedFileIds: Id<"_storage">[] = [];
    let metadataSaved = false;
    const documentsToSave: Array<{
      fileId: Id<"_storage">;
      fileName: string;
      fileSize: number;
      type: DocType;
    }> = [];
    setUploadProgress({ current: 0, total: fileArray.length });

    try {
      let docType: DocType = row.types[0];
      if (row.types.length > 1 && row.types.includes("articles")) {
        docType = articleSubType;
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (file.size > MAX_FILE_SIZE_BYTES) {
          skipped.push(`${file.name} (${formatFileSize(file.size)})`);
          setUploadProgress({ current: i + 1, total: fileArray.length });
          continue;
        }

        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();
        uploadedFileIds.push(storageId);

        documentsToSave.push({
          fileId: storageId,
          fileName: file.name,
          fileSize: file.size,
          type: docType,
        });

        setUploadProgress({ current: i + 1, total: fileArray.length });
      }

      if (documentsToSave.length > 0) {
        await saveDocuments({ documents: documentsToSave, loanId });
        metadataSaved = true;
      }

      if (skipped.length > 0) {
        setError(
          `${skipped.length} file${skipped.length > 1 ? "s" : ""} skipped (exceeds ${formatFileSize(MAX_FILE_SIZE_BYTES)}): ${skipped.join(", ")}`
        );
      }
    } catch (err) {
      if (!metadataSaved && uploadedFileIds.length > 0) {
        try {
          await discardUnsavedUploads({ fileIds: uploadedFileIds });
        } catch {
          // Best-effort cleanup; keep the original upload error visible to the user.
        }
      }
      setError(getErrorMessage(err, "Upload failed. Please try again."));
    } finally {
      setUploadingRow(null);
      setUploadProgress(null);
      // Reset file input
      const input = fileInputRefs.current[row.label];
      if (input) input.value = "";
    }
  }

  const requiredComplete = requiredRows.filter(
    (row) => getDocsForRow(row).length > 0
  ).length;

  function renderRow(row: DocRow) {
    const docs = getDocsForRow(row);
    const hasFiles = docs.length > 0;
    const isExpanded = expandedRows.has(row.label);
    const isUploading = uploadingRow !== null;
    const isThisRowUploading = uploadingRow === row.label;
    const isArticlesRow = row.types.includes("articles");

    return (
      <div key={row.label} className="border-b border-border last:border-b-0">
        <div className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          {/* Status icon */}
          {hasFiles ? (
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
          ) : row.required ? (
            <Circle className="size-5 shrink-0 text-amber-500" />
          ) : (
            <Circle className="size-5 shrink-0 text-muted-foreground/40" />
          )}

          {/* Expand toggle + label */}
          <button
            type="button"
            onClick={() => hasFiles && toggleExpanded(row.label)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            disabled={!hasFiles}
          >
            {hasFiles ? (
              isExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
            <span className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{row.label}</span>
            {row.required && !hasFiles && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                Required
              </span>
            )}
            {hasFiles && (
              <span className="shrink-0 text-xs text-muted-foreground">
                ({docs.length} {docs.length === 1 ? "file" : "files"})
              </span>
            )}
          </button>

          {row.note && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {row.note}
            </span>
          )}

          {/* Articles sub-type selector */}
          {isArticlesRow && (
            <select
              value={articleSubType}
              onChange={(e) =>
                setArticleSubType(e.target.value as "articles" | "operating_agreement")
              }
              className="rounded border border-border bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
            >
              <option value="articles">Articles</option>
              <option value="operating_agreement">OA</option>
            </select>
          )}

          {/* Upload button */}
          <input
            ref={(el) => {
              fileInputRefs.current[row.label] = el;
            }}
            type="file"
            accept={row.accept || ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"}
            multiple={row.multi}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(row, e.target.files);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRefs.current[row.label]?.click()}
            disabled={isUploading}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 sm:self-auto"
          >
            {isThisRowUploading ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                {uploadProgress && uploadProgress.total > 1
                  ? `${uploadProgress.current}/${uploadProgress.total}`
                  : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="size-3" />
                Upload
              </>
            )}
          </button>
        </div>

        {/* Expanded file list */}
        {isExpanded && hasFiles && (
          <div className="border-t border-border bg-muted/30 px-4 py-2">
            <div className="space-y-1">
              {docs.map((doc) => (
                <DocumentPreviewRow key={doc._id} document={doc} compact>
                  {isArticlesRow && (
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">
                      {DOC_TYPE_LABELS[doc.type] || doc.type}
                    </span>
                  )}
                </DocumentPreviewRow>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (documents === undefined) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Required Documents */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Required Documents
          </h3>
          <span className="text-xs text-muted-foreground">
            {requiredComplete}/{requiredRows.length} complete
          </span>
        </div>
        {requiredRows.map(renderRow)}
      </div>

      {/* Additional Documents */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Additional Documents
          </h3>
        </div>
        {additionalRows.map(renderRow)}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
