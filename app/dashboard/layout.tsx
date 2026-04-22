"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { cn } from "@/lib/utils";
import { premiumEase } from "@/lib/animations";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { FloatingMessenger } from "@/components/dashboard/floating-messenger";

function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:block w-64 shrink-0 border-r border-border/50 bg-sidebar" />
      <div className="flex-1">
        <div className="h-16 border-b border-border/50 bg-background/70 backdrop-blur-xl" />
        <div className="p-5 sm:p-8 lg:p-10">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}

function AnimatedPage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: premiumEase }}
    >
      {children}
    </motion.div>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const profile = useQuery(api.users.getMe);
  const claimProfile = useMutation(api.users.claimProfile);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Link authUserId on pending profiles (admin-created, not yet claimed).
  // getMe returns pending profiles via email fallback from the auth users
  // table, so the dashboard renders immediately — this just finalises the
  // authUserId link for future fast-path lookups.
  useEffect(() => {
    if (!profile || profile.authUserId) return;

    claimProfile().catch(() => {});
  }, [profile, claimProfile]);

  // Loading state
  if (profile === undefined) {
    return <AuthLoadingSkeleton />;
  }

  // No profile found — admin hasn't created one for this email yet
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
        <main className="p-5 sm:p-8 lg:p-10">
          <AnimatedPage>{children}</AnimatedPage>
        </main>
      </div>
      <FloatingMessenger />
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
        <AuthLoadingSkeleton />
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
