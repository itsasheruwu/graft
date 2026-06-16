import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Images, PanelRightOpen } from "lucide-react";
import { useAssetFinderSettings } from "@/hooks/use-asset-finder-settings";
import { AnimatedStatusText } from "@/components/ui/transition-effects";

type Variant = "popup" | "options";

export function AssetFinderSettings({ variant }: { variant: Variant }) {
  const {
    assetFinderEnabled,
    assetFinderHideBlankAssets,
    setEnabled,
    setHideBlankAssets,
    openAssetBrowser,
    status,
  } = useAssetFinderSettings({ variant });
  const isPopup = variant === "popup";
  const hideBlankId = isPopup
    ? "asset-finder-hide-blank-assets"
    : "options-asset-finder-hide-blank-assets";

  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        Scan the current page for images, SVGs, backgrounds, icons, video posters,
        and other visible media assets.
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={isPopup ? "asset-finder-enabled" : "options-asset-finder-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup ? "Enable asset finder" : "Enable Asset Finder"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Browse page media in an in-page Graft panel
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "asset-finder-enabled" : "options-asset-finder-enabled"}
          checked={assetFinderEnabled}
          onCheckedChange={setEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <div
        className={cn(
          "ml-3 border-l border-border/70 pl-3",
          !assetFinderEnabled && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor={hideBlankId}
              className={cn(
                assetFinderEnabled ? "cursor-pointer" : "cursor-not-allowed",
                isPopup ? "text-xs font-normal leading-snug" : "text-sm font-medium"
              )}
            >
              Hide blank assets
            </Label>
            <p
              className={cn(
                "text-muted-foreground",
                isPopup ? "text-[11px] leading-snug" : "text-xs leading-snug"
              )}
            >
              Skip empty or tiny image entries in the asset browser.
            </p>
          </div>
          <Switch
            id={hideBlankId}
            checked={assetFinderHideBlankAssets}
            disabled={!assetFinderEnabled}
            onCheckedChange={setHideBlankAssets}
            size="sm"
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Images className="size-3.5" />
          Page asset browser
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Open a responsive panel on the active page with filters, previews,
          copy/open actions, page highlighting, and hide controls.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={openAssetBrowser}
          disabled={!assetFinderEnabled}
        >
          <PanelRightOpen className="size-3.5" />
          Open asset browser
        </Button>
      </div>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
