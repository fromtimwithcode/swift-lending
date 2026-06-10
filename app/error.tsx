"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ErrorFallback } from "@/components/error-fallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Unhandled app error", error);
    }
    toast.error("Something went wrong. Please try again.");
  }, [error]);

  return <ErrorFallback reset={reset} homeHref="/" homeLabel="Go home" />;
}
