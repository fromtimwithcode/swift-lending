"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { PageSkeleton } from "@/components/dashboard/skeleton";

export default function DashboardPage() {
  const profile = useQuery(api.users.getMe);
  const router = useRouter();

  useEffect(() => {
    if (profile) {
      switch (profile.role) {
        case "admin":
        case "developer":
          router.replace("/dashboard/admin");
          break;
        case "borrower":
          router.replace("/dashboard/borrower");
          break;
        case "investor":
          router.replace("/dashboard/investor");
          break;
      }
    }
  }, [profile, router]);

  return <PageSkeleton />;
}
