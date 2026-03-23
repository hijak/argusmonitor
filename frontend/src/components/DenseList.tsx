import { cn } from "@/lib/utils";

export function DenseListSurface({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm", className)}>{children}</div>;
}

export function DenseListRow({
  className,
  interactive = false,
  selected = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      {...props}
      className={cn(
        "transition-colors",
        interactive && "cursor-pointer hover:bg-surface-hover",
        selected && "bg-primary/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DenseCardRow({
  className,
  selected = false,
  children,
}: {
  className?: string;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-background/60 p-3 shadow-sm transition-all sm:p-4",
        selected ? "border-primary/40 bg-primary/5" : "hover:border-primary/30 hover:bg-surface-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}
