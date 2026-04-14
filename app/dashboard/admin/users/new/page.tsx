"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const ROLE_OPTIONS = [
  { value: "borrower", label: "Borrower" },
  { value: "investor", label: "Investor" },
  { value: "admin", label: "Admin" },
  { value: "developer", label: "Developer" },
] as const;

const ROLE_HELP: Record<string, string> = {
  borrower: "This user will be able to access the borrower portal, submit loan applications, and manage draw requests.",
  investor: "This user will be able to access the investor portal and view their portfolio and statements.",
  admin: "This user will have full admin access to manage loans, users, and all platform settings.",
  developer: "This user will have full admin access, identical to the Admin role, plus developer-specific features.",
};

export default function NewUserPage() {
  const createUser = useMutation(api.users.createUser);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    role: "borrower" as "admin" | "developer" | "borrower" | "investor",
    email: "",
    displayName: "",
    company: "",
    phone: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.email) {
      setError("Email is required");
      return;
    }
    if (!form.displayName) {
      setError("Name is required");
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        role: form.role,
        email: form.email,
        displayName: form.displayName,
        company: form.company || undefined,
        phone: form.phone || undefined,
      });
      router.push("/dashboard/admin/users");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create user"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/users"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="Add User"
          description="Create a new user profile"
        />
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className={labelClass}>Role</label>
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {ROLE_HELP[form.role]}
            </p>
          </div>

          <div>
            <label className={labelClass}>Email Address</label>
            <input
              className={inputClass}
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="user@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The user will use this email to log in and claim their profile.
            </p>
          </div>

          <div>
            <label className={labelClass}>Full Name</label>
            <input
              className={inputClass}
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className={labelClass}>Company / Entity / LLC</label>
            <input
              className={inputClass}
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              className={inputClass}
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard/admin/users"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create User
          </button>
        </div>
      </form>
    </div>
  );
}
