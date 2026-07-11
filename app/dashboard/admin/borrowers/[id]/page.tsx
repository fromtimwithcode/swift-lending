"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Loader2, ArrowLeft, MessageSquare, Pencil, Save, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";
import { BorrowerDetailTabs } from "@/components/dashboard/borrower-detail-tabs";
import { BorrowerFinancialPanel } from "@/components/dashboard/borrower-financial-panel";
import { BorrowerRelatedPartiesPanel } from "@/components/dashboard/borrower-related-parties-panel";

export default function AdminBorrowerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"userProfiles">;
  const data = useQuery(api.admin.getBorrowerDetail, { id });
  const toggleActive = useMutation(api.users.toggleUserActive);
  const updateProfile = useMutation(api.users.updateUserProfile);

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
    router.replace(`/dashboard/admin/borrowers/${id}`, { scroll: false });
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
      toast.error("Display name is required");
      return;
    }
    if (!editData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        id,
        displayName: editData.displayName || undefined,
        email: editData.email || undefined,
        phone: editData.phone || undefined,
        company: editData.company || undefined,
      });
      setEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "min-h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20";

  const loanColumns: Column<(typeof loans)[number]>[] = [
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "entityName",
      header: "LLC",
      sortable: true,
      render: (row) => row.entityName || "—",
      className: "max-w-[180px] truncate",
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
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/admin/borrowers"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title={profile.displayName}
          description={profile.email}
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
                  >
                    <X className="size-4" aria-hidden="true" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 max-sm:flex-1"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </button>
                  <Link
                    href={`/dashboard/admin/messages?partnerId=${id}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
                  >
                    <MessageSquare className="size-4" aria-hidden="true" />
                    Message
                  </Link>
                </>
              )}
            </div>
          }
        />
      </div>

      <Suspense
        fallback={
          <div className="rounded-2xl bg-muted/70 p-1 shadow-[inset_0_0_0_1px_var(--border)]">
            <div className="skeleton h-10 w-full" />
          </div>
        }
      >
        <BorrowerDetailTabs
          onTabChange={() => setEditing(false)}
          overview={
            <div className="space-y-6">
              <section className="card-premium p-5 sm:p-6" aria-labelledby="borrower-profile-heading">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 id="borrower-profile-heading" className="text-sm font-semibold">Profile</h2>
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={toggling}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-[background-color,color,scale] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] ${
                      profile.isActive
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "bg-primary/20 text-foreground hover:bg-primary/30"
                    } disabled:opacity-50`}
                  >
                    {toggling && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                    {profile.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {editing ? (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="profile-name" className="text-sm font-medium">Name</label>
                        <input
                          id="profile-name"
                          className={inputClass}
                          value={editData.displayName}
                          onChange={(event) => setEditData((current) => ({ ...current, displayName: event.target.value }))}
                          autoComplete="name"
                          spellCheck={false}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="profile-email" className="text-sm font-medium">Email</label>
                        <input
                          id="profile-email"
                          className={inputClass}
                          type="email"
                          value={editData.email}
                          onChange={(event) => setEditData((current) => ({ ...current, email: event.target.value }))}
                          autoComplete="email"
                          spellCheck={false}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="profile-phone" className="text-sm font-medium">Phone</label>
                        <input
                          id="profile-phone"
                          className={inputClass}
                          type="tel"
                          value={editData.phone}
                          onChange={(event) => setEditData((current) => ({ ...current, phone: event.target.value }))}
                          autoComplete="tel"
                          spellCheck={false}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="profile-company" className="text-sm font-medium">Company</label>
                        <input
                          id="profile-company"
                          className={inputClass}
                          value={editData.company}
                          onChange={(event) => setEditData((current) => ({ ...current, company: event.target.value }))}
                          autoComplete="organization"
                          spellCheck={false}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Detail label="Name" value={profile.displayName} />
                      <Detail label="Email" value={profile.email} />
                      <Detail label="Phone" value={profile.phone || "—"} />
                      <Detail label="Company" value={profile.company || "—"} />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Status</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          profile.isActive
                            ? "bg-primary/20 text-foreground"
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {profile.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <Detail
                        label="Onboarded"
                        value={profile.onboardedAt ? new Date(profile.onboardedAt).toLocaleDateString() : "Not yet"}
                      />
                    </>
                  )}
                </div>
              </section>

              <section className="card-premium p-5 sm:p-6" aria-labelledby="borrower-properties-heading">
                <h2 id="borrower-properties-heading" className="mb-4 text-sm font-semibold">
                  Properties <span className="text-muted-foreground tabular-nums">({loans.length})</span>
                </h2>
                {loans.length > 0 ? (
                  <DataTable
                    data={loans as unknown as Record<string, unknown>[]}
                    columns={loanColumns as Column<Record<string, unknown>>[]}
                    onRowClick={(row) =>
                      router.push(`/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`)
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No properties yet.</p>
                )}
              </section>

              <section className="card-premium p-5 sm:p-6" aria-labelledby="borrower-draws-heading">
                <h2 id="borrower-draws-heading" className="mb-4 text-sm font-semibold">
                  Draw requests <span className="text-muted-foreground tabular-nums">({draws.length})</span>
                </h2>
                {draws.length > 0 ? (
                  <DataTable
                    data={draws as unknown as Record<string, unknown>[]}
                    columns={drawColumns as Column<Record<string, unknown>>[]}
                    onRowClick={(row) =>
                      router.push(`/dashboard/admin/draws/${(row as unknown as { _id: string })._id}`)
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No draw requests yet.</p>
                )}
              </section>

              <section className="card-premium p-5 sm:p-6" aria-labelledby="borrower-documents-heading">
                <h2 id="borrower-documents-heading" className="mb-4 text-sm font-semibold">
                  Documents <span className="text-muted-foreground tabular-nums">({documents.length})</span>
                </h2>
                {documents.length > 0 ? (
                  <div className="divide-y divide-border">
                    {documents.map((document) => (
                      <DocumentPreviewRow key={document._id} document={document} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents yet.</p>
                )}
              </section>
            </div>
          }
          financial={<BorrowerFinancialPanel borrowerId={id} />}
          parties={<BorrowerRelatedPartiesPanel borrowerId={id} />}
        />
      </Suspense>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
