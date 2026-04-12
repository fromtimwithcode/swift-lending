"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
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
  const saveDocument = useMutation(api.documents.saveDocument);

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleUpload = async () => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("File size must be under 10MB.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const url = await generateUploadUrl();
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed: " + result.statusText);
      const { storageId } = await result.json();

      await saveDocument({
        fileId: storageId,
        fileName: file.name,
        fileSize: file.size,
        type: docType,
        loanId,
        drawRequestId,
      });

      setFile(null);
      setDocType("other");
      onUploaded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Document</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Document Type
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
            <label className="mb-1.5 block text-sm font-medium">File</label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
