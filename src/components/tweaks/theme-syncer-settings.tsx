import { ThemeSyncerYoutubeNest } from "@/components/theme-syncer-youtube-nest";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useThemeSyncerSettings } from "@/hooks/use-theme-syncer-settings";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedStatusText } from "@/components/ui/transition-effects";

type Variant = "popup" | "options";

export function ThemeSyncerSettings({ variant }: { variant: Variant }) {
  const {
    themeSyncerEnabled,
    themeSyncerBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    youtubeSwitchChecked,
    youtubeDisabled,
    status,
    setMasterEnabled,
    setYoutubeEnabled,
    addBlockedDomain,
    removeBlockedDomain,
  } = useThemeSyncerSettings({ variant });

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
          ? "Mirror your system light or dark preference on supported sites."
          : "Keep page themes aligned with your device appearance where supported."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={isPopup ? "theme-syncer-enabled" : "options-theme-syncer-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup ? "Sync with system light / dark" : "Enable Theme Syncer"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Device theme synchronization
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "theme-syncer-enabled" : "options-theme-syncer-enabled"}
          checked={themeSyncerEnabled}
          onCheckedChange={setMasterEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <ThemeSyncerYoutubeNest
        variant={variant}
        youtubeDisabled={youtubeDisabled}
        youtubeSwitchChecked={youtubeSwitchChecked}
        onYoutubeChange={setYoutubeEnabled}
        labelId={isPopup ? "theme-syncer-youtube-label" : "options-theme-syncer-youtube-label"}
        switchId={isPopup ? "theme-syncer-youtube" : "options-theme-syncer-youtube"}
        title="YouTube scope"
        description={
          isPopup
            ? "Include YouTube, Music, and mobile pages"
            : "Apply to YouTube pages"
        }
        detail={isPopup ? undefined : "youtube.com, Music, mobile subdomains, and related hosts"}
        footer={
          isPopup ? (
            <Alert className="border-border/60 bg-background/70 py-2">
              <Info className="size-3.5 shrink-0 text-muted-foreground" />
              <AlertDescription className="text-xs leading-snug text-muted-foreground [&_p]:m-0">
                Disable this if YouTube uses a fixed Light/Dark theme instead of
                device theme.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-500/35 bg-amber-500/5 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-sm font-medium text-amber-950 dark:text-amber-100">
                YouTube appearance
              </AlertTitle>
              <AlertDescription className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90 [&_p]:m-0">
                If you manually force Light or Dark (without &quot;Use device
                theme&quot;), turn off the sub-option above so this extension
                does not override your choice.
              </AlertDescription>
            </Alert>
          )
        }
      />

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <div>
          <p className={cn(isPopup ? "text-xs font-medium" : "text-sm font-medium")}>
            Per-site blocklist
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Theme Syncer will not run on these hostnames (e.g. sites where you
            prefer a fixed theme).
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="example.com"
            value={blocklistInput}
            onChange={(e) => setBlocklistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBlockedDomain();
              }
            }}
            className={cn(
              "flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addBlockedDomain}
          >
            Add
          </Button>
        </div>
        {themeSyncerBlockedDomains.length > 0 ? (
          <ul className="t-stagger is-shown flex flex-wrap gap-2">
            {themeSyncerBlockedDomains.map((domain, index) => (
              <li
                key={domain}
                className="t-stagger-line inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs"
                style={{ transitionDelay: `calc(var(--stagger-stagger) * ${index})` }}
              >
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
      </div>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
