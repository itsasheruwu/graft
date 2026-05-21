import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CornerDownRight } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "popup" | "options";

export function ThemeSyncerYoutubeNest({
  variant,
  youtubeDisabled,
  youtubeSwitchChecked,
  onYoutubeChange,
  labelId,
  switchId,
  title,
  description,
  detail,
  footer,
}: {
  variant: Variant;
  youtubeDisabled: boolean;
  youtubeSwitchChecked: boolean;
  onYoutubeChange: (enabled: boolean) => void;
  labelId: string;
  switchId: string;
  title: string;
  description: string;
  detail?: string;
  footer: ReactNode;
}) {
  const isPopup = variant === "popup";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border transition-colors",
        youtubeDisabled
          ? "border-dashed border-border/60 bg-muted/15"
          : "border-border/70 bg-muted/30 shadow-[inset_0_1px_0_0_oklch(1_0_0/6%)] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/4%)]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-2.5 py-2",
          youtubeDisabled ? "border-border/40 bg-muted/20" : "border-border/50 bg-muted/45"
        )}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm"
          aria-hidden
        >
          <CornerDownRight className={isPopup ? "size-3" : "size-3.5"} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              isPopup ? "text-[10px]" : "text-xs"
            )}
          >
            Sub-option
          </p>
          <p
            className={cn(
              "font-medium text-foreground",
              isPopup ? "text-xs" : "text-sm"
            )}
          >
            {title}
          </p>
        </div>
      </div>

      <div className={cn("space-y-3", isPopup ? "p-3" : "p-4")}>
        <div
          className={cn(
            "flex gap-3",
            isPopup ? "items-start" : "items-start"
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Label
              id={labelId}
              htmlFor={switchId}
              className={cn(
                youtubeDisabled
                  ? "cursor-not-allowed text-muted-foreground"
                  : "cursor-pointer",
                isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
              )}
            >
              {description}
            </Label>
            {detail ? (
              <p
                className={cn(
                  "text-muted-foreground",
                  isPopup ? "text-[11px] leading-snug" : "text-xs leading-relaxed"
                )}
              >
                {detail}
              </p>
            ) : null}
            {youtubeDisabled ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                Turn on Theme Syncer above to change this.
              </p>
            ) : null}
          </div>
          <Switch
            id={switchId}
            aria-labelledby={labelId}
            checked={youtubeSwitchChecked}
            disabled={youtubeDisabled}
            onCheckedChange={onYoutubeChange}
            size={isPopup ? "sm" : "default"}
            className="mt-0.5 shrink-0"
          />
        </div>
        {footer}
      </div>
    </div>
  );
}
