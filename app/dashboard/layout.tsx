"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { cn } from "@/lib/utils";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";

function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}

function DashboardShell({ children }: { children: ReactNode }) {
  const profile = useQuery(api.users.getMe);
  const claimProfile = useMutation(api.users.claimProfile);
  const [claimed, setClaimed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Attempt to claim profile on first load
  useEffect(() => {
    if (profile === null && !claimed) {
      setClaimed(true);
      claimProfile().catch(() => {});
    }
  }, [profile, claimed, claimProfile]);

  // Loading state
  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // No profile found — account pending
  if (profile === null) {
    return <AccountPending />;
  }

  // Deactivated account
  if (!profile.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold">Account Deactivated</h2>
          <p className="mt-2 text-muted-foreground">
            Your account has been deactivated. Contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={profile.role}
        displayName={profile.displayName}
        email={profile.email}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function AccountPending() {
  const { signOut } = useAuthActions();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-8 text-primary" />
        </div>
        <h2 className="mt-6 text-xl font-bold">Account Pending</h2>
        <p className="mt-2 text-muted-foreground">
          Your account is being set up. An administrator will grant you access
          shortly.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 text-sm text-muted-foreground underline hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>

      <Authenticated>
        <DashboardShell>{children}</DashboardShell>
      </Authenticated>
    </>
  );
}
