"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { MAX_FILE_SIZE_BYTES } from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const DOC_TYPES = [
  { value: "articles", label: "Articles of Organization" },
  { value: "operating_agreement", label: "Operating Agreement" },
  { value: "closing_statement", label: "Closing Statement" },
  { value: "wire_instructions", label: "Wire Instructions" },
  { value: "property_photo", label: "Property Photo" },
  { value: "receipt", label: "Receipt" },
  { value: "lien_waiver", label: "Lien Waiver" },
  { value: "rehab_budget", label: "Rehab Budget" },
  { value: "other", label: "Other" },
] as const;

const ACCEPTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"];
const ACCEPTED_FILE_TYPES = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const MAX_UPLOAD_BATCH_FILES = 50;

type DocType = (typeof DOC_TYPES)[number]["value"];

export type DrawUploadOption = {
  _id: Id<"drawRequests">;
  amountRequested: number;
  workDescription: string;
  status: string;
  _creationTime: number;
  propertyAddress?: string;
};

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  loanId?: Id<"loans">;
  drawRequestId?: Id<"drawRequests">;
  drawOptions?: DrawUploadOption[];
  defaultDocType?: DocType;
  title?: string;
  description?: string;
  onUploaded?: () => void;
}

export function FileUploadDialog({
  open,
  onClose,
  loanId,
  drawRequestId,
  drawOptions = [],
  defaultDocType = "other",
  title = "Upload Documents",
  description = "Drop multiple files here or browse from your computer.",
  onUploaded,
}: FileUploadDialogProps) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocuments = useMutation(api.documents.saveDocuments);
  const discardUnsavedUploads = useMutation(api.documents.discardUnsavedUploads);

  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState<DocType>(defaultDocType);
  const [selectedDrawRequestId, setSelectedDrawRequestId] = useState<Id<"drawRequests"> | "">(drawRequestId ?? "");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setDocType(defaultDocType);
    setSelectedDrawRequestId(drawRequestId ?? "");
  }, [defaultDocType, drawRequestId, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || uploading) return;
      setFiles([]);
      setDocType(defaultDocType);
      setSelectedDrawRequestId(drawRequestId ?? "");
      setDragActive(false);
      setUploadProgress(null);
      setError("");
      onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [defaultDocType, drawRequestId, onClose, open, uploading]);

  if (!open) return null;

  const targetDrawRequestId = drawRequestId ?? (selectedDrawRequestId || undefined);
  const targetDraw = drawOptions.find((draw) => draw._id === targetDrawRequestId);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const invalidFiles = files.filter((file) => getFileIssue(file));
  const canUpload = files.length > 0 && invalidFiles.length === 0 && !uploading;
  const uploadLabel = uploading && uploadProgress
    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}`
    : files.length > 1
      ? `Upload ${files.length} Files`
      : "Upload";

  function addFiles(incomingFiles: File[]) {
    if (incomingFiles.length === 0) return;

    const existingKeys = new Set(files.map(getFileKey));
    const nextFiles = [...files];
    let duplicateCount = 0;
    let maxCountSkipped = 0;

    for (const file of incomingFiles) {
      const key = getFileKey(file);
      if (existingKeys.has(key)) {
        duplicateCount += 1;
        continue;
      }
      if (nextFiles.length >= MAX_UPLOAD_BATCH_FILES) {
        maxCountSkipped += 1;
        continue;
      }

      existingKeys.add(key);
      nextFiles.push(file);
    }

    const messages: string[] = [];
    if (duplicateCount > 0) {
      messages.push(`${duplicateCount} duplicate ${duplicateCount === 1 ? "file was" : "files were"} skipped.`);
    }
    if (maxCountSkipped > 0) {
      messages.push(`Only ${MAX_UPLOAD_BATCH_FILES} files can be uploaded at a time.`);
    }

    setFiles(nextFiles);
    setError(messages.join(" "));
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  function resetForm() {
    setFiles([]);
    setDocType(defaultDocType);
    setSelectedDrawRequestId(drawRequestId ?? "");
    setDragActive(false);
    setUploadProgress(null);
    setError("");
  }

  function handleClose() {
    if (uploading) return;
    resetForm();
    onClose();
  }

  async function handleUpload() {
    if (files.length === 0) return;

    const firstInvalidFile = files.find((file) => getFileIssue(file));
    if (firstInvalidFile) {
      setError(`${firstInvalidFile.name}: ${getFileIssue(firstInvalidFile)}`);
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError("");
    const uploadedFileIds: Id<"_storage">[] = [];
    let metadataSaved = false;

    try {
      const uploadedDocuments: Array<{
        fileId: Id<"_storage">;
        fileName: string;
        fileSize: number;
        type: DocType;
      }> = [];

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setUploadProgress({ current: index + 1, total: files.length });

        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();
        uploadedFileIds.push(storageId);

        uploadedDocuments.push({
          fileId: storageId,
          fileName: file.name,
          fileSize: file.size,
          type: docType,
        });
      }

      await saveDocuments({
        documents: uploadedDocuments,
        loanId,
        drawRequestId: targetDrawRequestId,
      });
      metadataSaved = true;

      onUploaded?.();
      resetForm();
      onClose();
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
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" onClick={handleClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-150">
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h3 id={titleId} className="text-xl font-semibold text-balance">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:opacity-50"
            aria-label="Close upload dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Document Type for All Files
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                disabled={uploading}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-[border-color,box-shadow] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {(drawOptions.length > 0 || drawRequestId) && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Draw Folder
                </label>
                {drawRequestId ? (
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/35 px-3 text-sm">
                    <FolderOpen className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 truncate">
                      {targetDraw ? getDrawOptionLabel(targetDraw) : "Selected draw request"}
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedDrawRequestId}
                    onChange={(e) => setSelectedDrawRequestId(e.target.value as Id<"drawRequests"> | "")}
                    disabled={uploading}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-[border-color,box-shadow] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                  >
                    <option value="">General documents</option>
                    {drawOptions.map((draw) => (
                      <option key={draw._id} value={draw._id}>
                        {getDrawOptionLabel(draw)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              const relatedTarget = event.relatedTarget;
              if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={cn(
              "group relative cursor-pointer rounded-2xl border border-dashed p-6 text-center transition-[border-color,background-color,box-shadow,transform] active:scale-[0.99]",
              dragActive
                ? "border-primary bg-primary/10 shadow-sm ring-4 ring-primary/10"
                : "border-border bg-muted/20 hover:border-primary/60 hover:bg-primary/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              className="sr-only"
              disabled={uploading}
            />
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-background shadow-[0_1px_0_rgba(255,255,255,0.35),0_10px_28px_rgba(0,0,0,0.08)] transition-transform group-hover:-translate-y-0.5">
              <Upload className="size-6 text-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold">
              Drop files here or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to {MAX_UPLOAD_BATCH_FILES} files, {formatFileSize(MAX_FILE_SIZE_BYTES)} each. PDFs, images, Word, and Excel files are supported.
            </p>
          </div>

          {files.length > 0 && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <p className="text-sm font-semibold">
                    {files.length} {files.length === 1 ? "file" : "files"} selected
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatFileSize(totalSize)} total
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFiles([]);
                    setError("");
                  }}
                  disabled={uploading}
                  className="inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-[0.96] disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {files.map((selectedFile) => (
                  <SelectedFileRow
                    key={getFileKey(selectedFile)}
                    file={selectedFile}
                    disabled={uploading}
                    onRemove={() => {
                      setFiles((currentFiles) => currentFiles.filter((file) => getFileKey(file) !== getFileKey(selectedFile)));
                      setError("");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {(error || invalidFiles.length > 0) && (
            <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>
                {error || `${invalidFiles.length} ${invalidFiles.length === 1 ? "file needs" : "files need"} attention before uploading.`}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/10 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.96] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/85 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploadLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectedFileRow({
  file,
  disabled,
  onRemove,
}: {
  file: File;
  disabled: boolean;
  onRemove: () => void;
}) {
  const previewUrl = useObjectUrl(file);
  const issue = getFileIssue(file);
  const isImage = file.type.startsWith("image/");

  return (
    <div className="flex items-center gap-3 rounded-xl bg-background px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
        {isImage && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Local object URLs are not compatible with next/image.
          <img src={previewUrl} alt="" className="image-outline h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="size-5" />
        ) : (
          <FileText className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium">{file.name}</p>
          {!issue && <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />}
        </div>
        <p className={cn("mt-0.5 text-xs tabular-nums", issue ? "text-red-500" : "text-muted-foreground")}>
          {issue || formatFileSize(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 active:scale-[0.96] disabled:opacity-50"
        aria-label={`Remove ${file.name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function useObjectUrl(file: File) {
  const url = useMemo(() => {
    if (!file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getFileIssue(file: File) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Too large. Max ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`;
  }
  if (!isAcceptedFile(file)) {
    return "Unsupported file type.";
  }

  return "";
}

function isAcceptedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return Boolean(extension && ACCEPTED_EXTENSIONS.includes(extension));
}

function getDrawOptionLabel(draw: DrawUploadOption) {
  const date = new Date(draw._creationTime).toLocaleDateString();
  return `${formatCurrency(draw.amountRequested)} draw - ${date} - ${draw.workDescription}`;
}
