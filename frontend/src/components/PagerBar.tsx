import { cn } from "@/lib/utils";

export function PagerBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      {children}
    </div>
  );
}

export function PagerSummary({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-sm text-muted-foreground", className)}>{children}</div>;
}

export function PagerMeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm text-muted-foreground", className)}>{children}</div>;
}
