"use client";

import { useRef, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_FILE_SIZE_BYTES } from "@/convex/lib/constants";
import { MAX_PURCHASE_CONTRACT_FILES } from "@/convex/lib/loanDocuments";
import { getErrorMessage } from "@/lib/errors";
import { formatFileSize } from "@/lib/format";

export interface PendingPurchaseContract {
  storageId: Id<"_storage">;
  fileName: string;
  fileSize: number;
}

export function PurchaseContractUpload({
  files,
  onFilesChange,
  uploading,
  onUploadingChange,
}: {
  files: PendingPurchaseContract[];
  onFilesChange: Dispatch<SetStateAction<PendingPurchaseContract[]>>;
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    if (files.length + selected.length > MAX_PURCHASE_CONTRACT_FILES) {
      toast.error(`Maximum ${MAX_PURCHASE_CONTRACT_FILES} purchase contract files allowed`);
      resetInput();
      return;
    }

    const validFiles = Array.from(selected).filter((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`File "${file.name}" is too large (${formatFileSize(file.size)}). Max ${formatFileSize(MAX_FILE_SIZE_BYTES)}`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) {
      resetInput();
      return;
    }

    onUploadingChange(true);
    try {
      for (const file of validFiles) {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) throw new Error("Upload failed: " + result.statusText);
        const { storageId } = await result.json();
        onFilesChange((prev) => [...prev, { storageId, fileName: file.name, fileSize: file.size }]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Purchase contract upload failed"));
    } finally {
      onUploadingChange(false);
      resetInput();
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        multiple
        onChange={(e) => handleUpload(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-center text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 active:scale-[0.96]"
      >
        {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        <span>{uploading ? "Uploading..." : "Upload purchase contract"}</span>
        <span className="text-xs font-normal text-muted-foreground">
          PDF, Word, or image files (max {formatFileSize(MAX_FILE_SIZE_BYTES)} each)
        </span>
      </button>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.storageId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Purchase Contract · {formatFileSize(file.fileSize)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onFilesChange((prev) => prev.filter((f) => f.storageId !== file.storageId))
                }
                disabled={uploading}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 active:scale-[0.96]"
                aria-label={`Remove ${file.fileName}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
