"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/dashboard/page-header";
import { ROLE_LABELS } from "@/convex/lib/constants";
import {
  Loader2,
  Settings,
  Sun,
  Moon,
  Monitor,
  Check,
  Users,
  FileText,
  PlusCircle,
  Activity,
  Briefcase,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  developer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  borrower: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  investor: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

function getQuickLinks(role: string) {
  if (role === "admin" || role === "developer") {
    return [
      { href: "/dashboard/admin/users", label: "User Management", icon: Users },
      { href: "/dashboard/admin/activity", label: "Activity Log", icon: Activity },
      { href: "/dashboard/admin/settings", label: "All Users", icon: Settings },
    ];
  }
  if (role === "borrower") {
    return [
      { href: "/dashboard/borrower/documents", label: "My Documents", icon: FileText },
      { href: "/dashboard/borrower/apply", label: "New Loan Application", icon: PlusCircle },
    ];
  }
  if (role === "investor") {
    return [
      { href: "/dashboard/investor", label: "Portfolio", icon: Briefcase },
      { href: "/dashboard/investor/statements", label: "Statements", icon: BarChart3 },
    ];
  }
  return [];
}

export default function SettingsPage() {
  const me = useQuery(api.users.getMe);
  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    company: "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (me && !formInitialized) {
      setForm({
        displayName: me.displayName ?? "",
        phone: me.phone ?? "",
        company: me.company ?? "",
      });
      setFormInitialized(true);
    }
  }, [me, formInitialized]);

  if (me === undefined) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const isClean =
    form.displayName === (me.displayName ?? "") &&
    form.phone === (me.phone ?? "") &&
    form.company === (me.company ?? "");

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFeedback(null);
  };

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await updateMyProfile({
        displayName: form.displayName,
        phone: form.phone,
        company: form.company,
      });
      setFormInitialized(false);
      setFeedback({ type: "success", message: "Profile updated successfully." });
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  }

  const initial = me.displayName?.charAt(0)?.toUpperCase() ?? "?";
  const quickLinks = getQuickLinks(me.role);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Profile & Edit Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold truncate">{me.displayName}</p>
              <p className="text-sm text-muted-foreground truncate">{me.email}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[me.role] ?? "bg-muted text-muted-foreground"}`}
            >
              {ROLE_LABELS[me.role] ?? me.role}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={me.email}
                disabled
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Managed by your Google account.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="Company name"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isClean || saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {feedback && (
              <p
                className={`text-sm ${feedback.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                {feedback.message}
              </p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Appearance Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold mb-3">Appearance</h2>
            <div className="space-y-2">
              {THEME_OPTIONS.map((opt) => {
                const isActive = mounted && theme === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1 font-medium">{opt.label}</span>
                    {isActive && <Check className="size-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Links Card */}
          {quickLinks.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold mb-3">Quick Links</h2>
              <div className="space-y-1">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="flex-1">{link.label}</span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
