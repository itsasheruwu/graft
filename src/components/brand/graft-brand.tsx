import graftIcon from "@/assets/icons/graft-48.png";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const TAGLINE = "Small fixes, grafted onto the web.";

type GraftBrandProps = {
  variant?: "popup" | "page";
  /** Page title below the wordmark (e.g. "Hidden elements"). Omit for "Graft" only. */
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function GraftBrand({
  variant = "page",
  title,
  description,
  actions,
  className,
}: GraftBrandProps) {
  const isPopup = variant === "popup";
  const pageTitle = title?.trim();
  const showSubtitle = Boolean(pageTitle && pageTitle.toLowerCase() !== "graft");

  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <img
          src={graftIcon}
          alt=""
          aria-hidden
          className={cn(
            "shrink-0 rounded-[10px] object-cover shadow-sm ring-1 ring-graft-glow/35",
            isPopup ? "size-[22px]" : "size-7"
          )}
        />
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span
              className={cn(
                "font-semibold tracking-tight text-foreground",
                isPopup ? "text-sm" : "text-2xl"
              )}
            >
              Graft
            </span>
            {showSubtitle ? (
              <>
                <span
                  className={cn(
                    "text-muted-foreground/50",
                    isPopup ? "text-xs" : "text-lg"
                  )}
                  aria-hidden
                >
                  /
                </span>
                <span
                  className={cn(
                    "font-medium tracking-tight text-foreground",
                    isPopup ? "text-sm" : "text-xl"
                  )}
                >
                  {pageTitle}
                </span>
              </>
            ) : null}
          </div>
          {description ? (
            <p
              className={cn(
                "text-muted-foreground leading-relaxed",
                isPopup ? "text-[11px] leading-snug" : "text-sm"
              )}
            >
              {description}
            </p>
          ) : !isPopup && !showSubtitle ? (
            <p className="text-sm text-muted-foreground">{TAGLINE}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export { TAGLINE as GRAFT_TAGLINE };
