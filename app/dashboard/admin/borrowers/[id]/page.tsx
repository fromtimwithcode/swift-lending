"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Loader2, ArrowLeft, Download, MessageSquare, Pencil, Save, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminBorrowerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"userProfiles">;
  const data = useQuery(api.admin.getBorrowerDetail, { id });
  const toggleActive = useMutation(api.users.toggleUserActive);
  const updateProfile = useMutation(api.users.updateUserProfile);

  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    displayName: "",
    email: "",
    phone: "",
    company: "",
  });

  if (data === undefined) {
    return <DetailPageSkeleton />;
  }

  const { profile, loans, draws, documents } = data;

  const handleToggleActive = async () => {
    if (profile.isActive) {
      setConfirmDeactivate(true);
      return;
    }
    setToggling(true);
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} activated`);
    } finally {
      setToggling(false);
    }
  };

  const executeDeactivate = async () => {
    setToggling(true);
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} deactivated`);
    } finally {
      setToggling(false);
      setConfirmDeactivate(false);
    }
  };

  const startEditing = () => {
    setEditing(true);
    setEditData({
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone ?? "",
      company: profile.company ?? "",
    });
  };

  const handleSaveProfile = async () => {
    if (!editData.displayName.trim()) {
      setError("Display name is required");
      return;
    }
    if (!editData.email.trim()) {
      setError("Email is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateProfile({
        id,
        displayName: editData.displayName || undefined,
        email: editData.email || undefined,
        phone: editData.phone || undefined,
        company: editData.company || undefined,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

  const loanColumns: Column<(typeof loans)[number]>[] = [
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "loanAmount",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.loanAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "terms",
      header: "Terms",
      className: "hidden md:table-cell",
    },
  ];

  const drawColumns: Column<(typeof draws)[number]>[] = [
    {
      key: "propertyAddress",
      header: "Property",
      className: "max-w-[180px] truncate",
    },
    {
      key: "amountRequested",
      header: "Amount",
      render: (row) => formatCurrency(row.amountRequested),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Date",
      render: (row) => new Date(row._creationTime).toLocaleDateString(),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/borrowers"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title={profile.displayName}
          description={profile.email}
          actions={
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                  <Link
                    href={`/dashboard/admin/messages?partnerId=${id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <MessageSquare className="size-4" />
                    Message
                  </Link>
                </>
              )}
            </div>
          }
        />
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Profile</h3>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
              profile.isActive
                ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
            } disabled:opacity-50`}
          >
            {toggling && <Loader2 className="size-3 animate-spin" />}
            {profile.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <input
                  className={inputClass}
                  value={editData.displayName}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, displayName: e.target.value }))
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <input
                  className={inputClass}
                  type="email"
                  value={editData.email}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <input
                  className={inputClass}
                  value={editData.phone}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Company</p>
                <input
                  className={inputClass}
                  value={editData.company}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, company: e.target.value }))
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{profile.displayName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{profile.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{profile.company || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Onboarded</p>
                <p className="text-sm font-medium">
                  {profile.onboardedAt
                    ? new Date(profile.onboardedAt).toLocaleDateString()
                    : "Not yet"}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Loans */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Loans ({loans.length})
        </h3>
        {loans.length > 0 ? (
          <DataTable
            data={loans as unknown as Record<string, unknown>[]}
            columns={loanColumns as Column<Record<string, unknown>>[]}
            onRowClick={(row) =>
              router.push(
                `/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`
              )
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">No loans</p>
        )}
      </div>

      {/* Draw Requests */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Draw Requests ({draws.length})
        </h3>
        {draws.length > 0 ? (
          <DataTable
            data={draws as unknown as Record<string, unknown>[]}
            columns={drawColumns as Column<Record<string, unknown>>[]}
            onRowClick={(row) =>
              router.push(
                `/dashboard/admin/draws/${(row as unknown as { _id: string })._id}`
              )
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">No draw requests</p>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Documents ({documents.length})
        </h3>
        {documents.length > 0 ? (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="text-sm font-medium">{doc.fileName}</p>
                  <StatusBadge status={doc.type} />
                </div>
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Download className="size-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No documents</p>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeactivate}
        title={`Deactivate ${profile.displayName}?`}
        description="This borrower will lose access to the portal."
        confirmLabel="Deactivate"
        variant="destructive"
        loading={toggling}
        onConfirm={executeDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </div>
  );
}
