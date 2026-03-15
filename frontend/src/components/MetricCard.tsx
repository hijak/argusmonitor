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
    <div className={cn("rounded-lg border border-border bg-card p-5 transition-colors hover:bg-surface-hover", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
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
  );
}
