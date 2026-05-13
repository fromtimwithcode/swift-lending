"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ExportButton } from "@/components/dashboard/export-button";
import { FileText, Upload, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";

export default function BorrowerDocumentsPage() {
  const documents = useQuery(api.documents.getMyDocuments);
  const deleteDocument = useMutation(api.documents.deleteDocument);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Id<"documents"> | null>(null);

  if (documents === undefined) {
    return <PageSkeleton />;
  }

  const filtered =
    typeFilter === "all"
      ? documents
      : documents.filter((d) => d.type === typeFilter);

  const types = [
    "all",
    ...Array.from(new Set(documents.map((d) => d.type))),
  ];

  const handleDelete = async (id: Id<"documents">) => {
    setDeleting(id);
    try {
      await deleteDocument({ id });
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Documents"
        description={`${documents.length} document${documents.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {documents.length > 0 && (
              <ExportButton
                data={documents as unknown as Record<string, unknown>[]}
                columns={[
                  { header: "File Name", key: "fileName" },
                  { header: "Type", key: "type" },
                  { header: "Property", key: "propertyAddress" },
                ]}
                filename="my-documents"
                title="My Documents"
              />
            )}
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Upload className="size-4" />
              Upload
            </button>
          </div>
        }
      />

      {/* Type filter */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {/* Documents list */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((doc) => (
            <div
              key={doc._id}
              className="px-4 py-2"
            >
              <DocumentPreviewRow document={doc}>
                <button
                  onClick={() => setConfirmDeleteId(doc._id)}
                  disabled={deleting === doc._id}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 disabled:opacity-50"
                >
                  {deleting === doc._id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </DocumentPreviewRow>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Upload your first document to get started."
          action={
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Upload className="size-4" />
              Upload Document
            </button>
          }
        />
      )}

      <FileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this document?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting !== null}
        onConfirm={async () => { if (confirmDeleteId) await handleDelete(confirmDeleteId); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
