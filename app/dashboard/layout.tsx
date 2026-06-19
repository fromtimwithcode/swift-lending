"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileMenuBar } from "@/components/dashboard/mobile-menu-bar";
import { cn } from "@/lib/utils";
import { premiumEase } from "@/lib/animations";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { PageSkeleton } from "@/components/dashboard/skeleton";

const FloatingMessenger = dynamic<{
  profile: Pick<Doc<"userProfiles">, "_id" | "role">;
  unreadCount?: number;
}>(
  () => import("@/components/dashboard/floating-messenger").then((mod) => mod.FloatingMessenger),
  { ssr: false, loading: () => null }
);

function getDashboardHomeHref(role: string) {
  if (role === "admin" || role === "developer") return "/dashboard/admin";
  if (role === "borrower") return "/dashboard/borrower";
  if (role === "investor") return "/dashboard/investor";
  return "/dashboard";
}

function getRolePrefix(role: string): "admin" | "borrower" | "investor" {
  if (role === "admin" || role === "developer") return "admin";
  if (role === "investor") return "investor";
  return "borrower";
}

function AuthLoadingSkeleton() {
  return (
    <div className="flex min-h-screen min-w-0 overflow-x-clip bg-background">
      <div className="hidden lg:block w-64 shrink-0 border-r border-border/50 bg-sidebar" />
      <div className="min-w-0 flex-1">
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
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      className="min-w-0"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: premiumEase }}
    >
      {children}
    </motion.div>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  const profile = useQuery(api.users.getMe);
  const messageUnreadCount = useQuery(api.messages.getUnreadCount, profile ? {} : "skip");
  const notificationUnreadCount = useQuery(api.notifications.getUnreadCount, profile ? {} : "skip");
  const claimProfile = useMutation(api.users.claimProfile);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

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
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-premium w-full max-w-md p-8 text-center">
          <h2 className="text-xl font-bold tracking-tight">Account Deactivated</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
            Your account has been deactivated. Contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  const homeHref = getDashboardHomeHref(profile.role);
  const rolePrefix = getRolePrefix(profile.role);
  const showFloatingMessenger = !pathname.includes("/messages");

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-background">
      <Sidebar
        role={profile.role}
        displayName={profile.displayName}
        email={profile.email}
        homeHref={homeHref}
        messageUnreadCount={messageUnreadCount}
        notificationUnreadCount={notificationUnreadCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={cn(
          "min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          rolePrefix={rolePrefix}
          notificationUnreadCount={notificationUnreadCount}
        />
        <main className="min-h-[calc(100vh_-_4rem)] min-w-0 overflow-x-clip px-4 py-6 pb-[calc(7rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:py-8 sm:pb-[calc(7rem_+_env(safe-area-inset-bottom))] lg:px-10 lg:py-10 lg:pb-10">
          <div className="mx-auto w-full min-w-0 max-w-[1440px]">
            <AnimatedPage>{children}</AnimatedPage>
          </div>
        </main>
        <MobileMenuBar
          role={profile.role}
          moreOpen={sidebarOpen}
          messageUnreadCount={messageUnreadCount}
          notificationUnreadCount={notificationUnreadCount}
          onMoreClick={() => setSidebarOpen(true)}
        />
      </div>
      {showFloatingMessenger && (
        <div className="hidden lg:block">
          <FloatingMessenger
            profile={{ _id: profile._id, role: profile.role }}
            unreadCount={messageUnreadCount}
          />
        </div>
      )}
    </div>
  );
}

function AccountPending() {
  const { signOut } = useAuthActions();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="card-premium w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-8 text-primary" />
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight">Account Pending</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
          Your account is being set up. An administrator will grant you access
          shortly.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
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
