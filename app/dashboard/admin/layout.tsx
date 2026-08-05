"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { PageSkeleton } from "@/components/dashboard/skeleton";

function getRoleHome(role: string) {
  if (role === "borrower") return "/dashboard/borrower";
  if (role === "investor") return "/dashboard/investor";
  return "/dashboard";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const profile = useQuery(api.users.getMe);
  const router = useRouter();
  const hasAdminAccess = profile?.role === "admin" || profile?.role === "developer";

  useEffect(() => {
    if (profile && !hasAdminAccess) {
      router.replace(getRoleHome(profile.role));
    }
  }, [hasAdminAccess, profile, router]);

  if (profile === undefined) return <PageSkeleton />;
  if (!profile || !hasAdminAccess) return null;

  return children;
}
