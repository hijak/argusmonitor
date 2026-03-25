import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, change, changeType = "neutral", icon, className }: MetricCardProps) {
  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm transition-colors hover:bg-surface-hover", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="block truncate whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            title={label}
          >
            {label}
          </span>
          <div className="mt-3 flex items-end gap-2">
            <span className="truncate text-3xl font-semibold tracking-tight text-foreground">{value}</span>
            {change && (
              <span className={cn(
                "mb-1 text-xs font-medium",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-critical",
                changeType === "neutral" && "text-muted-foreground",
              )}>
                {change}
              </span>
            )}
          </div>
        </div>
        {icon && <span className="rounded-xl bg-surface p-2 text-muted-foreground">{icon}</span>}
      </div>
    </div>
  );
}
