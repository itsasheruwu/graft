import * as React from "react";
import { CornerDownRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SubOptionVariant = "popup" | "options" | "sub-options";

type SubOptionProps = React.ComponentProps<"div"> & {
  title: string;
  eyebrow?: string;
  disabled?: boolean;
  /** Typography scale — `sub-options` matches nested popup accordion panels. */
  variant?: SubOptionVariant;
};

function SubOption({
  title,
  eyebrow = "Sub-option",
  disabled = false,
  variant = "popup",
  className,
  children,
  ...props
}: SubOptionProps) {
  const isCompact = variant === "popup" || variant === "sub-options";

  return (
    <div
      data-slot="sub-option"
      data-variant={variant}
      className={cn(
        "relative overflow-hidden rounded-lg border transition-colors",
        disabled
          ? "border-dashed border-border/60 bg-muted/15"
          : "border-border/70 bg-muted/30 shadow-[inset_0_1px_0_0_oklch(1_0_0/6%)] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/4%)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-2.5 py-2",
          disabled ? "border-border/40 bg-muted/20" : "border-border/50 bg-muted/45"
        )}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm"
          aria-hidden
        >
          <CornerDownRight
            className={isCompact ? "size-3" : "size-3.5"}
            strokeWidth={2}
          />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              isCompact ? "text-[10px]" : "text-xs"
            )}
          >
            {eyebrow}
          </p>
          <p
            className={cn(
              "font-medium text-foreground",
              isCompact ? "text-xs" : "text-sm"
            )}
          >
            {title}
          </p>
        </div>
      </div>

      <div className={cn(isCompact ? "space-y-3 p-3" : "space-y-3 p-4")}>
        {children}
      </div>
    </div>
  );
}

export { SubOption, type SubOptionVariant };
