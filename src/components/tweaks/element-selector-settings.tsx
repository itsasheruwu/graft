import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info, List } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useElementSelectorSettings } from "@/hooks/use-element-selector-settings";

type Variant = "popup" | "options";

function openHiddenElementsPage() {
  const url = chrome.runtime.getURL("hidden-elements.html");
  chrome.tabs.create({ url });
}

export function ElementSelectorSettings({ variant }: { variant: Variant }) {
  const { elementSelectorEnabled, setEnabled, status } =
    useElementSelectorSettings({ variant });
  const isPopup = variant === "popup";

  return (
    <div className="space-y-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        {isPopup
          ? "Turn on selector mode on the current page and click elements to hide or capture details."
          : "Enable selector mode to choose DOM elements, copy context, and remove them from the current domain."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={isPopup ? "element-selector-enabled" : "options-element-selector-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup ? "Enable element selector" : "Enable Element Selector"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Inspect and remove page elements per-domain
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "element-selector-enabled" : "options-element-selector-enabled"}
          checked={elementSelectorEnabled}
          onCheckedChange={setEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Info className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertTitle className={isPopup ? "text-xs font-medium" : "text-sm font-medium"}>
          Selector behavior
        </AlertTitle>
        <AlertDescription
          className={cn(
            isPopup ? "text-xs leading-snug text-muted-foreground [&_p]:m-0" : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          When enabled, the page cursor becomes a selector and hovered elements are outlined.
          Remove actions are stored per domain (locally on this device) so reloading keeps them hidden.
          Press {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Z to undo the last hide in this tab.
        </AlertDescription>
      </Alert>

      <div
        className={cn(
          "rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <p className="text-sm font-medium text-foreground">Hidden elements</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Review everything you have removed, filter by site, preview on the live page, or unhide entries.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={openHiddenElementsPage}
        >
          <List className="size-3.5" />
          Open hide list
        </Button>
      </div>

      <p
        className={cn(
          "min-h-[1rem]",
          isPopup ? "text-xs" : "text-sm",
          status?.isError ? "text-destructive" : "text-primary"
        )}
        aria-live="polite"
      >
        {status?.message ?? ""}
      </p>
    </div>
  );
}
