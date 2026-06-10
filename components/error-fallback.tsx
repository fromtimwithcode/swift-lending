"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

type ErrorFallbackProps = {
  title?: string;
  description?: string;
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
};

export function ErrorFallback({
  title = "Something went wrong",
  description = "Please try again. If this keeps happening, contact support.",
  reset,
  homeHref,
  homeLabel = "Go back",
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-[0_4px_24px_oklch(0_0_0_/_8%),0_1px_4px_oklch(0_0_0_/_4%)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {homeHref && (
            <Link
              href={homeHref}
              className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-[0.96]"
            >
              {homeLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
