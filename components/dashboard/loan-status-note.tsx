import { MessageSquareText } from "lucide-react";
import type { LoanStatus } from "@/convex/lib/loanStatus";

export function LoanStatusNote({
  status,
  note,
}: {
  status: LoanStatus;
  note?: string;
}) {
  if (!note) return null;
  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <MessageSquareText
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
      />
      <div className="min-w-0 space-y-1.5">
        <h3 className="text-sm font-semibold">
          {status === "additional_info_needed"
            ? "Information needed"
            : status === "denied"
              ? "Reason for denial"
              : "Status note"}
        </h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {note}
        </p>
      </div>
    </div>
  );
}
