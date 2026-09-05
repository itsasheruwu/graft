import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { findGraftMenuSurface } from "@/lib/extension-ui";
import { cn } from "@/lib/utils";

type MenuPromptOverlayProps = {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
};

/**
 * Blurs the popup/options menu shell and shows a centered prompt on top.
 * Portals into the nearest `[data-graft-menu-surface]` host.
 */
export function MenuPromptOverlay({
  open,
  title,
  description,
  children,
  className,
  onDismiss,
}: MenuPromptOverlayProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(findGraftMenuSurface());
  }, [open]);

  if (!open || !host) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="graft-menu-prompt-title"
      aria-describedby="graft-menu-prompt-description"
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center p-3",
        "bg-background/55 backdrop-blur-md",
        "animate-in fade-in-0 duration-150",
        className
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss?.();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onDismiss?.();
        }
      }}
    >
      <div
        className={cn(
          "w-full max-w-[248px] rounded-xl border border-border/80 bg-card p-3 shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
      >
        <div className="space-y-1.5">
          <h2
            id="graft-menu-prompt-title"
            className="text-sm font-medium leading-snug text-foreground"
          >
            {title}
          </h2>
          <p
            id="graft-menu-prompt-description"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            {description}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">{children}</div>
      </div>
    </div>,
    host
  );
}
