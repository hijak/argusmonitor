import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DetailPanelSection({
  title,
  description,
  icon,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm", className)}>
      <div className="flex flex-col gap-2 border-b border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <span>{title}</span>
          </div>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <CardContent className={cn("p-4 sm:p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function DetailStatCard({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-surface p-4", className)}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-xl font-semibold text-foreground", tone)}>{value}</div>
    </div>
  );
}
