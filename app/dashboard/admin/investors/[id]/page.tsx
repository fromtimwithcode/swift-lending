"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvestorInvestments } from "@/components/dashboard/investor-investments";
import { useBusinessToday } from "@/hooks/use-business-today";
import { Loader2, ArrowLeft, MessageSquare, Pencil, Save, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminInvestorDetailPage() {
  const params = useParams();
  const id = params.id as Id<"userProfiles">;
  const today = useBusinessToday();
  const data = useQuery(api.investments.getInvestorDetail, { id, today });
  const toggleActive = useMutation(api.users.toggleUserActive);
  const updateProfile = useMutation(api.users.updateUserProfile);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [toggling, setToggling] = useState(false);
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

  const { profile } = data;

  const handleToggleActive = async () => {
    if (profile.isActive) {
      setConfirmDeactivate(true);
      return;
    }
    setToggling(true);
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} activated`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to toggle status"));
    } finally {
      setToggling(false);
    }
  };

  const executeDeactivate = async () => {
    setToggling(true);
    try {
      await toggleActive({ id });
      toast.success(`${profile.displayName} deactivated`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to toggle status"));
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
    "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/admin/investors"
          aria-label="Back to investors"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <PageHeader
          title={profile.displayName}
          description={profile.email}
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 max-sm:flex-1"
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
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                  <Link
                    href={`/dashboard/admin/messages?partnerId=${id}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 max-sm:flex-1"
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

      <InvestorInvestments investorId={id} portfolio={data} />
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
    </div>
  );
}
