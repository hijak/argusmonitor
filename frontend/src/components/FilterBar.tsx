import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm text-muted-foreground lg:justify-center lg:gap-2", className)}>
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
