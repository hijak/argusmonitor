import { cn } from "@/lib/utils";

export function EmptyState({
  message,
  className,
  compact = false,
}: {
  message: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card text-center text-sm text-muted-foreground",
        compact ? "px-4 py-8" : "px-4 py-10",
        className,
      )}
    >
      {message}
    </div>
  );
}

export function LoadingState({
  message,
  className,
}: {
  message: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}>{message}</div>;
}
