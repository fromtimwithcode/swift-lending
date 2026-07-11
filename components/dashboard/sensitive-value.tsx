"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

interface SensitiveValueProps {
  label: string;
  maskedValue: string;
  onReveal: () => Promise<{ value: string; expiresAt: number }>;
  formatValue?: (value: string) => string;
}

export function SensitiveValue({
  label,
  maskedValue,
  onReveal,
  formatValue = (value) => value,
}: SensitiveValueProps) {
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hide = useCallback(() => {
    setRevealedValue(null);
    setExpiresAt(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!revealedValue || !expiresAt) return;
    const timeout = window.setTimeout(hide, Math.max(0, expiresAt - Date.now()));
    const handleVisibility = () => {
      if (document.hidden) hide();
    };
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [expiresAt, hide, revealedValue]);

  const toggle = async () => {
    if (revealedValue) {
      hide();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onReveal();
      if (document.hidden || !document.hasFocus()) return;
      setRevealedValue(result.value);
      setExpiresAt(Math.min(result.expiresAt, Date.now() + 30_000));
    } catch (cause) {
      setError(getErrorMessage(cause, `Couldn't reveal ${label.toLowerCase()}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tabular-nums tracking-wide">
          {revealedValue ? formatValue(revealedValue) : maskedValue}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={`${revealedValue ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={Boolean(revealedValue)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : revealedValue ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
