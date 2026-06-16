import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubOption } from "@/components/ui/sub-option";
import { Switch } from "@/components/ui/switch";
import { AnimatedStatusText } from "@/components/ui/transition-effects";
import { useSoundBoosterSettings } from "@/hooks/use-sound-booster-settings";
import {
  SOUND_BOOSTER_MAX_GAIN,
  SOUND_BOOSTER_MIN_GAIN,
} from "@/lib/tweak-controls";
import { cn } from "@/lib/utils";
import { Shield, Volume2, X } from "lucide-react";

type Variant = "popup" | "options";

export function SoundBoosterSettings({ variant }: { variant: Variant }) {
  const {
    soundBoosterEnabled,
    soundBoosterGain,
    soundBoosterBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    currentHostname,
    currentSiteBlocked,
    status,
    setEnabled,
    setGain,
    addBlockedDomain,
    removeBlockedDomain,
  } = useSoundBoosterSettings({ variant });
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
          ? "Boost regular HTML5 audio and video on supported pages."
          : "Use Web Audio gain to raise regular HTML5 media volume. Some protected or cross-origin players may refuse audio routing."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={isPopup ? "sound-booster-enabled" : "options-sound-booster-enabled"}
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup ? "Enable sound booster" : "Enable Sound Booster"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Global gain for page audio and video elements
            </p>
          ) : null}
        </div>
        <Switch
          id={isPopup ? "sound-booster-enabled" : "options-sound-booster-enabled"}
          checked={soundBoosterEnabled}
          onCheckedChange={setEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <SubOption
        title="Boost level"
        eyebrow="Sound Booster"
        disabled={!soundBoosterEnabled}
        variant={isPopup ? "popup" : "options"}
      >
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor={isPopup ? "sound-booster-gain" : "options-sound-booster-gain"}
            className={cn(
              soundBoosterEnabled ? "cursor-pointer" : "cursor-not-allowed",
              isPopup ? "text-xs font-normal" : "text-sm font-medium"
            )}
          >
            Volume multiplier
          </Label>
          <span className="shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium">
            {soundBoosterGain.toFixed(1)}x
          </span>
        </div>
        <input
          id={isPopup ? "sound-booster-gain" : "options-sound-booster-gain"}
          type="range"
          min={SOUND_BOOSTER_MIN_GAIN}
          max={SOUND_BOOSTER_MAX_GAIN}
          step="0.1"
          value={soundBoosterGain}
          disabled={!soundBoosterEnabled}
          onChange={(event) => setGain(Number(event.target.value))}
          className="h-8 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
      </SubOption>

      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          If a site blocks Web Audio routing, Graft leaves that player unchanged.
        </AlertDescription>
      </Alert>

      <SubOption
        title="Per-site blocklist"
        eyebrow="Sound Booster"
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
        {soundBoosterBlockedDomains.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {soundBoosterBlockedDomains.map((domain) => (
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
