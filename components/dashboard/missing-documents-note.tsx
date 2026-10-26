import { FileWarning } from "lucide-react";

export function MissingDocumentsNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
      <FileWarning
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        strokeWidth={1.5}
      />
      <div className="min-w-0 space-y-1.5">
        <h3 className="text-sm font-semibold admin:text-[13px] admin:font-bold admin:uppercase admin:tracking-wide admin:text-foreground">Missing documents</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {note}
        </p>
      </div>
    </div>
  );
}
