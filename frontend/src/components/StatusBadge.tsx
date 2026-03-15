import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        healthy: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        critical: "bg-critical/15 text-critical",
        unknown: "bg-muted text-muted-foreground",
        info: "bg-primary/15 text-primary",
      },
      pulse: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "healthy",
      pulse: false,
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, pulse, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        variant === "healthy" && "bg-success",
        variant === "warning" && "bg-warning",
        variant === "critical" && "bg-critical",
        variant === "unknown" && "bg-muted-foreground",
        variant === "info" && "bg-primary",
        pulse && "pulse-live"
      )} />
      {children}
    </span>
  );
}
