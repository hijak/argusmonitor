import * as React from "react";

import { cn } from "@/lib/utils";

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex",
      orientation === "horizontal" ? "items-center gap-2" : "flex-col gap-1.5",
      className,
    )}
    {...props}
  />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium text-foreground", className)}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

export { Field, FieldLabel };
