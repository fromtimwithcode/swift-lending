"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { MAX_FILE_SIZE_BYTES } from "@/convex/lib/constants";
import { formatFileSize } from "@/lib/format";
import { X, Upload, Loader2 } from "lucide-react";

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

const MAX_UPLOAD_BATCH_FILES = 50;

type DocType = (typeof DOC_TYPES)[number]["value"];

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  loanId?: Id<"loans">;
  drawRequestId?: Id<"drawRequests">;
  onUploaded?: () => void;
}

export function FileUploadDialog({
  open,
  onClose,
  loanId,
  drawRequestId,
  onUploaded,
}: FileUploadDialogProps) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocuments = useMutation(api.documents.saveDocuments);

  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState<DocType>("other");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length > MAX_UPLOAD_BATCH_FILES) {
      setFiles([]);
      setError(`Select up to ${MAX_UPLOAD_BATCH_FILES} files at a time.`);
      e.target.value = "";
      return;
    }

    setFiles(selectedFiles);
    setError("");
  };

  const resetForm = () => {
    setFiles([]);
    setDocType("other");
    setUploadProgress(null);
    setError("");
  };

  const handleClose = () => {
    if (uploading) return;
    resetForm();
    onClose();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setError(
        `${oversizedFiles.length} file${oversizedFiles.length === 1 ? " is" : "s are"} too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE_BYTES)} per file.`
      );
      return;
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError("");

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
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();

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
        drawRequestId,
      });

      onUploaded?.();
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
  const canUpload = files.length > 0 && oversizedFiles.length === 0 && !uploading;
  const uploadLabel = uploading && uploadProgress
    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}`
    : `Upload${files.length > 1 ? ` ${files.length} Files` : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Document</h3>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Document Type for All Files
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Files</label>
            <div className="relative">
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {files.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-muted/25 p-3">
                <div className="flex items-center justify-between gap-3 text-xs font-medium">
                  <span>
                    {files.length} {files.length === 1 ? "file" : "files"} selected
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatFileSize(totalSize)}</span>
                </div>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
                  {files.map((selectedFile) => {
                    const isOversized = selectedFile.size > MAX_FILE_SIZE_BYTES;
                    return (
                      <div
                        key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                        className="flex items-center justify-between gap-3 rounded-md bg-background/70 px-2 py-1.5 text-xs"
                      >
                        <span className="min-w-0 truncate">{selectedFile.name}</span>
                        <span className={isOversized ? "shrink-0 text-red-500" : "shrink-0 text-muted-foreground"}>
                          {formatFileSize(selectedFile.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploadLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
