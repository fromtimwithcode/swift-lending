import { cn } from "@/lib/utils";
import { type LucideIcon, Inbox } from "lucide-react";
import { type ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/60 px-6 py-20 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
        className
      )}
    >
      <div className="rounded-2xl bg-muted/60 p-5 text-muted-foreground">
        <Icon className="size-7" />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-balance">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
