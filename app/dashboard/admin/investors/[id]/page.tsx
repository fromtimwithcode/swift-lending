"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminInvestorDetailPage() {
  const params = useParams();
  const id = params.id as Id<"userProfiles">;
  const data = useQuery(api.admin.getInvestorDetail, { id });
  const toggleActive = useMutation(api.users.toggleUserActive);
  const updateProfile = useMutation(api.users.updateUserProfile);
  const createInvestment = useMutation(api.admin.createInvestment);
  const updateInvestment = useMutation(api.admin.updateInvestment);
  const deleteInvestmentMut = useMutation(api.admin.deleteInvestment);

  const [error, setError] = useState("");
  const [deletingInvestment, setDeletingInvestment] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDeleteInvestment, setConfirmDeleteInvestment] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    displayName: "",
    email: "",
    phone: "",
    company: "",
  });

  // Add investment form
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [addingInvestment, setAddingInvestment] = useState(false);
  const [investForm, setInvestForm] = useState({
    investmentAmount: "",
    inceptionDate: "",
    interestRate: "",
    totalPaymentsReceived: "0",
    nextPaymentDate: "",
    notes: "",
  });

  // Edit investment
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(
    null
  );
  const [editInvestForm, setEditInvestForm] = useState({
    investmentAmount: "",
    interestRate: "",
    totalPaymentsReceived: "",
    nextPaymentDate: "",
    notes: "",
  });
  const [savingInvestment, setSavingInvestment] = useState(false);

  if (data === undefined) {
    return <DetailPageSkeleton />;
  }

  const { profile, investments } = data;

  const handleToggleActive = async () => {
    if (profile.isActive) {
      setConfirmDeactivate(true);
      return;
    }
    setToggling(true);
    setError("");
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} activated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle status");
    } finally {
      setToggling(false);
    }
  };

  const executeDeactivate = async () => {
    setToggling(true);
    setError("");
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} deactivated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle status");
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

  const handleAddInvestment = async () => {
    if (!investForm.investmentAmount.trim() || !investForm.inceptionDate.trim() || !investForm.interestRate.trim() || !investForm.nextPaymentDate.trim()) {
      setError("Please fill in all required fields");
      return;
    }
    setAddingInvestment(true);
    setError("");
    try {
      await createInvestment({
        investorId: id,
        investmentAmount: Number(investForm.investmentAmount),
        inceptionDate: new Date(investForm.inceptionDate).getTime(),
        interestRate: Number(investForm.interestRate),
        totalPaymentsReceived: Number(investForm.totalPaymentsReceived) || 0,
        nextPaymentDate: new Date(investForm.nextPaymentDate).getTime(),
        notes: investForm.notes || undefined,
      });
      setShowAddInvestment(false);
      setInvestForm({
        investmentAmount: "",
        inceptionDate: "",
        interestRate: "",
        totalPaymentsReceived: "0",
        nextPaymentDate: "",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create investment");
    } finally {
      setAddingInvestment(false);
    }
  };

  const startEditInvestment = (inv: (typeof investments)[number]) => {
    setEditingInvestmentId(inv._id);
    setEditInvestForm({
      investmentAmount: String(inv.investmentAmount),
      interestRate: String(inv.interestRate),
      totalPaymentsReceived: String(inv.totalPaymentsReceived),
      nextPaymentDate: new Date(inv.nextPaymentDate)
        .toISOString()
        .split("T")[0],
      notes: inv.notes ?? "",
    });
  };

  const handleSaveInvestment = async () => {
    if (!editingInvestmentId) return;
    if (!editInvestForm.investmentAmount.trim() || !editInvestForm.interestRate.trim() || !editInvestForm.nextPaymentDate.trim()) {
      setError("Please fill in all required fields");
      return;
    }
    const parsedDate = new Date(editInvestForm.nextPaymentDate).getTime();
    if (isNaN(parsedDate)) {
      setError("Invalid next payment date");
      return;
    }
    setSavingInvestment(true);
    setError("");
    try {
      await updateInvestment({
        id: editingInvestmentId as Id<"investments">,
        investmentAmount: Number(editInvestForm.investmentAmount),
        interestRate: Number(editInvestForm.interestRate),
        totalPaymentsReceived: Number(editInvestForm.totalPaymentsReceived) || 0,
        nextPaymentDate: parsedDate,
        notes: editInvestForm.notes || undefined,
      });
      setEditingInvestmentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update investment");
    } finally {
      setSavingInvestment(false);
    }
  };

  const handleDeleteInvestment = async (investmentId: string) => {
    setDeletingInvestment(investmentId);
    setError("");
    try {
      await deleteInvestmentMut({ id: investmentId as Id<"investments"> });
      toast.success("Investment deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete investment");
    } finally {
      setDeletingInvestment(null);
      setConfirmDeleteInvestment(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

  const investmentColumns: Column<(typeof investments)[number]>[] = [
    {
      key: "investmentAmount",
      header: "Amount",
      sortable: true,
      render: (row) =>
        editingInvestmentId === row._id ? (
          <input
            className={inputClass}
            type="number"
            value={editInvestForm.investmentAmount}
            onChange={(e) =>
              setEditInvestForm((p) => ({
                ...p,
                investmentAmount: e.target.value,
              }))
            }
          />
        ) : (
          formatCurrency(row.investmentAmount)
        ),
    },
    {
      key: "inceptionDate",
      header: "Inception",
      render: (row) => new Date(row.inceptionDate).toLocaleDateString(),
    },
    {
      key: "interestRate",
      header: "Rate",
      render: (row) =>
        editingInvestmentId === row._id ? (
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={editInvestForm.interestRate}
            onChange={(e) =>
              setEditInvestForm((p) => ({
                ...p,
                interestRate: e.target.value,
              }))
            }
          />
        ) : (
          row.interestRate + "%"
        ),
    },
    {
      key: "totalPaymentsReceived",
      header: "Payments Received",
      render: (row) =>
        editingInvestmentId === row._id ? (
          <input
            className={inputClass}
            type="number"
            value={editInvestForm.totalPaymentsReceived}
            onChange={(e) =>
              setEditInvestForm((p) => ({
                ...p,
                totalPaymentsReceived: e.target.value,
              }))
            }
          />
        ) : (
          formatCurrency(row.totalPaymentsReceived)
        ),
      className: "hidden md:table-cell",
    },
    {
      key: "nextPaymentDate",
      header: "Next Payment",
      render: (row) =>
        editingInvestmentId === row._id ? (
          <input
            className={inputClass}
            type="date"
            value={editInvestForm.nextPaymentDate}
            onChange={(e) =>
              setEditInvestForm((p) => ({
                ...p,
                nextPaymentDate: e.target.value,
              }))
            }
          />
        ) : (
          new Date(row.nextPaymentDate).toLocaleDateString()
        ),
      className: "hidden md:table-cell",
    },
    {
      key: "_id",
      header: "",
      render: (row) =>
        editingInvestmentId === row._id ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveInvestment();
              }}
              disabled={savingInvestment}
              className="rounded-lg p-1 text-primary hover:bg-muted"
            >
              {savingInvestment ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingInvestmentId(null);
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                startEditInvestment(row);
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteInvestment(row._id);
              }}
              disabled={deletingInvestment === row._id}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
            >
              {deletingInvestment === row._id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/investors"
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

      {/* Investments */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Investments ({investments.length})
          </h3>
          <button
            onClick={() => setShowAddInvestment(!showAddInvestment)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="size-3" />
            Add Investment
          </button>
        </div>

        {showAddInvestment && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Amount *
                </label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="100000"
                  value={investForm.investmentAmount}
                  onChange={(e) =>
                    setInvestForm((p) => ({
                      ...p,
                      investmentAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Inception Date *
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={investForm.inceptionDate}
                  onChange={(e) =>
                    setInvestForm((p) => ({
                      ...p,
                      inceptionDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Interest Rate (%) *
                </label>
                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  placeholder="8.5"
                  value={investForm.interestRate}
                  onChange={(e) =>
                    setInvestForm((p) => ({
                      ...p,
                      interestRate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Payments Received
                </label>
                <input
                  className={inputClass}
                  type="number"
                  value={investForm.totalPaymentsReceived}
                  onChange={(e) =>
                    setInvestForm((p) => ({
                      ...p,
                      totalPaymentsReceived: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Next Payment Date *
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={investForm.nextPaymentDate}
                  onChange={(e) =>
                    setInvestForm((p) => ({
                      ...p,
                      nextPaymentDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Notes
                </label>
                <input
                  className={inputClass}
                  placeholder="Optional"
                  value={investForm.notes}
                  onChange={(e) =>
                    setInvestForm((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddInvestment(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddInvestment}
                disabled={addingInvestment}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              >
                {addingInvestment && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                Add
              </button>
            </div>
          </div>
        )}

        {investments.length > 0 ? (
          <DataTable
            data={investments as unknown as Record<string, unknown>[]}
            columns={
              investmentColumns as Column<Record<string, unknown>>[]
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">No investments yet</p>
        )}
      </div>
      <ConfirmDialog
        open={confirmDeactivate}
        title={`Deactivate ${profile.displayName}?`}
        description="This investor will lose access to the portal."
        confirmLabel="Deactivate"
        variant="destructive"
        loading={toggling}
        onConfirm={executeDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
      <ConfirmDialog
        open={confirmDeleteInvestment !== null}
        title="Delete this investment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingInvestment !== null}
        onConfirm={() => confirmDeleteInvestment && handleDeleteInvestment(confirmDeleteInvestment)}
        onCancel={() => setConfirmDeleteInvestment(null)}
      />
    </div>
  );
}
