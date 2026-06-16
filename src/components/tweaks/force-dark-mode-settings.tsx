import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubOption } from "@/components/ui/sub-option";
import { Switch } from "@/components/ui/switch";
import { AnimatedStatusText } from "@/components/ui/transition-effects";
import { useForceDarkModeSettings } from "@/hooks/use-force-dark-mode-settings";
import { cn } from "@/lib/utils";
import { Moon, Shield, X } from "lucide-react";

type Variant = "popup" | "options";

export function ForceDarkModeSettings({ variant }: { variant: Variant }) {
  const {
    forceDarkModeEnabled,
    forceDarkModeBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    currentHostname,
    currentSiteBlocked,
    status,
    setEnabled,
    addBlockedDomain,
    removeBlockedDomain,
  } = useForceDarkModeSettings({ variant });
  const isPopup = variant === "popup";

  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        {isPopup
          ? "Apply a balanced dark palette to pages that do not offer one."
          : "Darken common page surfaces while leaving images, video, canvas, and Graft UI surfaces alone."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={isPopup ? "force-dark-mode-enabled" : "options-force-dark-mode-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup ? "Enable force dark mode" : "Enable Force Dark Mode"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Balanced CSS restyling for arbitrary websites
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "force-dark-mode-enabled" : "options-force-dark-mode-enabled"}
          checked={forceDarkModeEnabled}
          onCheckedChange={setEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Moon className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          This avoids full-page inversion, so media should keep its original colors.
        </AlertDescription>
      </Alert>

      <SubOption
        title="Per-site blocklist"
        eyebrow="Force Dark Mode"
        variant={isPopup ? "popup" : "options"}
      >
        {currentHostname ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Current site: {currentHostname}
            {currentSiteBlocked ? " is blocked." : " is allowed."}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="example.com"
            value={blocklistInput}
            onChange={(event) => setBlocklistInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addBlockedDomain();
              }
            }}
          />
          <Button type="button" size="sm" variant="secondary" onClick={addBlockedDomain}>
            Add
          </Button>
        </div>
        {forceDarkModeBlockedDomains.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {forceDarkModeBlockedDomains.map((domain) => (
              <li
                key={domain}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs"
              >
                <Shield className="size-3 text-muted-foreground" />
                {domain}
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${domain}`}
                  onClick={() => removeBlockedDomain(domain)}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No blocked sites yet.</p>
        )}
      </SubOption>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
