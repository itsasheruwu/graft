import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getYoutubeLiveStatusRows,
  useYoutubeAutoTranslateLiveStatus,
} from "@/hooks/use-youtube-auto-translate-live-status";
import { useYoutubeAutoTranslateSettings } from "@/hooks/use-youtube-auto-translate-settings";
import { cn } from "@/lib/utils";
import { Activity, Languages, Shield } from "lucide-react";
import {
  AnimatedStatusText,
  AnimatedText,
  SlidingSegmentedControl,
} from "@/components/ui/transition-effects";

type Variant = "popup" | "options";

const TARGET_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

export function YoutubeAutoTranslateSettings({
  variant,
}: {
  variant: Variant;
}) {
  const {
    youtubeAutoTranslateEnabled,
    titlesSwitchChecked,
    descriptionsSwitchChecked,
    debugSwitchChecked,
    targetMode,
    targetLanguage,
    childrenDisabled,
    status,
    setMasterEnabled,
    setTitlesEnabled,
    setDescriptionsEnabled,
    setDebugEnabled,
    setTargetMode,
    setTargetLanguage,
    clearCache,
  } = useYoutubeAutoTranslateSettings({ variant });

  const isPopup = variant === "popup";
  const showLiveStatus = true;
  const liveStatus = useYoutubeAutoTranslateLiveStatus(showLiveStatus);

  return (
    <div className="space-y-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        {isPopup
          ? "Translate non-English YouTube metadata into your chosen language."
          : "Automatically translate YouTube titles and descriptions that are written in another language."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={
              isPopup
                ? "youtube-auto-translate-enabled"
                : "options-youtube-auto-translate-enabled"
            }
            className={cn(
              "cursor-pointer",
              isPopup
                ? "text-sm font-normal leading-snug"
                : "text-sm font-medium"
            )}
          >
            {isPopup ? "Auto-translate YouTube" : "Enable YouTube Auto Translation"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Uses Google Translate via the extension service worker
            </p>
          ) : null}
        </div>
        <Switch
          id={
            isPopup
              ? "youtube-auto-translate-enabled"
              : "options-youtube-auto-translate-enabled"
          }
          checked={youtubeAutoTranslateEnabled}
          onCheckedChange={setMasterEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <div className="ml-3 space-y-3 border-l border-border/70 pl-3">
        <NestedSwitch
          checked={titlesSwitchChecked}
          disabled={childrenDisabled}
          id={
            isPopup
              ? "youtube-auto-translate-titles"
              : "options-youtube-auto-translate-titles"
          }
          isPopup={isPopup}
          label="Titles"
          description="Video pages, feeds, recommendations, and search results"
          onCheckedChange={setTitlesEnabled}
        />
        <NestedSwitch
          checked={descriptionsSwitchChecked}
          disabled={childrenDisabled}
          id={
            isPopup
              ? "youtube-auto-translate-descriptions"
              : "options-youtube-auto-translate-descriptions"
          }
          isPopup={isPopup}
          label="Descriptions"
          description="Video description text on watch pages"
          onCheckedChange={setDescriptionsEnabled}
        />
        <NestedSwitch
          checked={debugSwitchChecked}
          disabled={false}
          id={
            isPopup
              ? "youtube-auto-translate-debug"
              : "options-youtube-auto-translate-debug"
          }
          isPopup={isPopup}
          label="Debug logs"
          description="Show boot and translation status in the extension logs"
          onCheckedChange={setDebugEnabled}
        />
      </div>

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <p className={cn(isPopup ? "text-xs font-medium" : "text-sm font-medium")}>
          Target language
        </p>
        <SlidingSegmentedControl
          value={targetMode}
          onChange={setTargetMode}
          disabled={childrenDisabled}
          options={[
            { value: "auto", label: "Auto (browser)" },
            { value: "fixed", label: "Fixed" },
          ]}
        />
        <div className="overflow-hidden">
          <select
            className={cn(
              "t-panel-slide flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              childrenDisabled && "opacity-60"
            )}
            data-open={targetMode === "fixed" ? "true" : "false"}
            value={targetLanguage}
            disabled={childrenDisabled}
            onChange={(e) => setTargetLanguage(e.target.value)}
          >
            {TARGET_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {targetMode === "auto" ? (
          <p className="text-xs text-muted-foreground">Follows your browser UI language.</p>
        ) : null}
      </div>

      <YoutubeAutoTranslateLiveStatusPanel
        isPopup={isPopup}
        rows={getYoutubeLiveStatusRows(liveStatus)}
      />

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20",
          isPopup ? "p-3" : "p-4"
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <p
            className={cn(
              isPopup ? "text-xs font-medium" : "text-sm font-medium"
            )}
          >
            Translation cache
          </p>
          <p
            className={cn(
              "text-muted-foreground",
              isPopup ? "text-[11px] leading-snug" : "text-xs leading-snug"
            )}
          >
            Clear saved YouTube translation results.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size={isPopup ? "sm" : "default"}
          className="shrink-0"
          onClick={clearCache}
        >
          Clear
        </Button>
      </div>

      <Alert
        className={
          isPopup
            ? "border-border/60 bg-background/70 py-2"
            : undefined
        }
      >
        <Shield className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertTitle
          className={isPopup ? "text-xs font-medium" : "text-sm font-medium"}
        >
          Privacy
        </AlertTitle>
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          Text you translate is sent to Google&apos;s public translate endpoint
          from the extension background worker. No account is required, but Google
          may log requests like any other translate client.
        </AlertDescription>
      </Alert>

      <Alert
        className={
          isPopup
            ? "border-border/60 bg-background/70 py-2"
            : undefined
        }
      >
        <Languages className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertTitle
          className={isPopup ? "text-xs font-medium" : "text-sm font-medium"}
        >
          Translation quality
        </AlertTitle>
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          Original text is preserved on hover. Short or low-confidence language
          detections are skipped instead of guessing.
        </AlertDescription>
      </Alert>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}

function YoutubeAutoTranslateLiveStatusPanel({
  isPopup,
  rows,
}: {
  isPopup: boolean;
  rows: { label: string; value: string }[];
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border/70 bg-muted/20",
        isPopup ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Activity className="size-3.5 text-muted-foreground" />
        <p
          className={cn(
            "font-medium leading-none",
            isPopup ? "text-xs" : "text-sm"
          )}
        >
          Active tab status
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] leading-snug">
        {rows.map((row) => (
          <div className="contents" key={row.label}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd
              className="min-w-0 truncate text-right text-foreground"
              title={row.value}
            >
              <AnimatedText text={row.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NestedSwitch({
  checked,
  disabled,
  id,
  isPopup,
  label,
  description,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  isPopup: boolean;
  label: string;
  description: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3",
        disabled && "opacity-60"
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <Label
          htmlFor={id}
          className={cn(
            "cursor-pointer",
            isPopup
              ? "text-xs font-normal leading-snug"
              : "text-sm font-medium"
          )}
        >
          {label}
        </Label>
        <p
          className={cn(
            "text-muted-foreground",
            isPopup ? "text-[11px] leading-snug" : "text-xs leading-snug"
          )}
        >
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        size="sm"
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
