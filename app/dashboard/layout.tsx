"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Loading — render nothing to prevent flicker */}
      <AuthLoading>{null}</AuthLoading>

      {/* Not authenticated — redirect (belt-and-suspenders with middleware) */}
      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>

      {/* Authenticated — render the page */}
      <Authenticated>{children}</Authenticated>
    </>
  );
}
