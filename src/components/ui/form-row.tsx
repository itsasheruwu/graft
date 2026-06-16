import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FormRow({
  className,
  label,
  description,
  htmlFor,
  children,
}: {
  className?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="form-row"
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-card/40 px-3 py-2.5",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={htmlFor} className="text-sm leading-snug">
          {label}
        </Label>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export { FormRow };
