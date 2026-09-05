import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormRow } from "@/components/ui/form-row";
import { Label } from "@/components/ui/label";
import { SubOption } from "@/components/ui/sub-option";
import { Switch } from "@/components/ui/switch";
import { AnimatedStatusText } from "@/components/ui/transition-effects";
import {
  WIKIPEDIA_READING_WIDTHS,
  type WikipediaReadingWidthPreset,
} from "@/lib/wikipedia-enhancements";
import { useWikipediaEnhancementsSettings } from "@/hooks/use-wikipedia-enhancements-settings";
import { BookOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "popup" | "options";

const WIDTH_LABELS: Record<WikipediaReadingWidthPreset, string> = {
  narrow: "Narrow",
  comfortable: "Comfortable",
  wide: "Wide",
};

export function WikipediaEnhancementsSettings({ variant }: { variant: Variant }) {
  const {
    wikipediaEnhancementsEnabled,
    wikipediaReadingWidthEnabled,
    wikipediaReadingWidthPreset,
    wikipediaNavigationCleanupEnabled,
    wikipediaCollapseReferencesEnabled,
    wikipediaFloatingTocEnabled,
    wikipediaSearchHighlightEnabled,
    wikipediaHideDonationBannersEnabled,
    status,
    setMasterEnabled,
    setReadingWidthEnabled,
    setReadingWidthPreset,
    setNavigationCleanupEnabled,
    setCollapseReferencesEnabled,
    setFloatingTocEnabled,
    setSearchHighlightEnabled,
    setHideDonationBannersEnabled,
  } = useWikipediaEnhancementsSettings({ variant });
  const isPopup = variant === "popup";
  const childDisabled = !wikipediaEnhancementsEnabled;

  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          "text-muted-foreground",
          isPopup ? "text-xs leading-relaxed" : "text-sm leading-relaxed"
        )}
      >
        {isPopup
          ? "Tune Wikipedia articles across language editions."
          : "Make Wikipedia articles easier to read without changing editing and research controls."}
      </p>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Label
            htmlFor={
              isPopup
                ? "wikipedia-enhancements-enabled"
                : "options-wikipedia-enhancements-enabled"
            }
            className={cn(
              "cursor-pointer",
              isPopup ? "text-sm font-normal leading-snug" : "text-sm font-medium"
            )}
          >
            {isPopup
              ? "Enable Wikipedia enhancements"
              : "Enable Wikipedia Enhancements"}
          </Label>
          {!isPopup ? (
            <p className="text-xs text-muted-foreground">
              Shared settings for Wikipedia language editions
            </p>
          ) : null}
        </div>
        <Switch
          id={
            isPopup
              ? "wikipedia-enhancements-enabled"
              : "options-wikipedia-enhancements-enabled"
          }
          checked={wikipediaEnhancementsEnabled}
          onCheckedChange={setMasterEnabled}
          size={isPopup ? "sm" : "default"}
          className="mt-0.5 shrink-0"
        />
      </div>

      <Alert className={isPopup ? "border-border/60 bg-background/70 py-2" : undefined}>
        <Info className="size-3.5 shrink-0 text-muted-foreground" />
        <AlertDescription
          className={cn(
            isPopup
              ? "text-xs leading-snug text-muted-foreground [&_p]:m-0"
              : "text-sm leading-relaxed [&_p]:m-0"
          )}
        >
          The pack applies only to main article pages. Edit, history, diff, and
          special pages are left alone.
        </AlertDescription>
      </Alert>

      <SubOption
        title="Article controls"
        eyebrow="Wikipedia"
        variant={isPopup ? "popup" : "options"}
        className={childDisabled ? "opacity-80" : undefined}
      >
        <FormRow
          label="Reading width"
          description="Keep article text at a comfortable width."
          htmlFor={isPopup ? "wikipedia-reading-width" : "options-wikipedia-reading-width"}
        >
          <Switch
            id={isPopup ? "wikipedia-reading-width" : "options-wikipedia-reading-width"}
            checked={wikipediaReadingWidthEnabled}
            disabled={childDisabled}
            onCheckedChange={setReadingWidthEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <div className="space-y-1.5">
          <Label
            htmlFor={
              isPopup
                ? "wikipedia-reading-width-preset"
                : "options-wikipedia-reading-width-preset"
            }
            className="text-xs text-muted-foreground"
          >
            Width preset
          </Label>
          <select
            id={
              isPopup
                ? "wikipedia-reading-width-preset"
                : "options-wikipedia-reading-width-preset"
            }
            value={wikipediaReadingWidthPreset}
            disabled={childDisabled || !wikipediaReadingWidthEnabled}
            onChange={(event) =>
              setReadingWidthPreset(event.target.value as WikipediaReadingWidthPreset)
            }
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(Object.keys(WIKIPEDIA_READING_WIDTHS) as WikipediaReadingWidthPreset[]).map(
              (preset) => (
                <option key={preset} value={preset}>
                  {WIDTH_LABELS[preset]} ({WIKIPEDIA_READING_WIDTHS[preset]})
                </option>
              )
            )}
          </select>
        </div>

        <FormRow
          label="Hide navigation clutter"
          description="Remove the left sidebar and language panels while preserving article controls."
          htmlFor={
            isPopup
              ? "wikipedia-navigation-cleanup"
              : "options-wikipedia-navigation-cleanup"
          }
        >
          <Switch
            id={
              isPopup
                ? "wikipedia-navigation-cleanup"
                : "options-wikipedia-navigation-cleanup"
            }
            checked={wikipediaNavigationCleanupEnabled}
            disabled={childDisabled}
            onCheckedChange={setNavigationCleanupEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <FormRow
          label="Collapse references"
          description="Keep citation links available while reducing the article tail."
          htmlFor={
            isPopup
              ? "wikipedia-collapse-references"
              : "options-wikipedia-collapse-references"
          }
        >
          <Switch
            id={
              isPopup
                ? "wikipedia-collapse-references"
                : "options-wikipedia-collapse-references"
            }
            checked={wikipediaCollapseReferencesEnabled}
            disabled={childDisabled}
            onCheckedChange={setCollapseReferencesEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <FormRow
          label="Floating table of contents"
          description="Keep article headings available in a desktop side panel."
          htmlFor={
            isPopup ? "wikipedia-floating-toc" : "options-wikipedia-floating-toc"
          }
        >
          <Switch
            id={
              isPopup ? "wikipedia-floating-toc" : "options-wikipedia-floating-toc"
            }
            checked={wikipediaFloatingTocEnabled}
            disabled={childDisabled}
            onCheckedChange={setFloatingTocEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <FormRow
          label="Highlight search terms"
          description="Emphasize a term from a Wikipedia search URL on the article."
          htmlFor={
            isPopup
              ? "wikipedia-search-highlight"
              : "options-wikipedia-search-highlight"
          }
        >
          <Switch
            id={
              isPopup
                ? "wikipedia-search-highlight"
                : "options-wikipedia-search-highlight"
            }
            checked={wikipediaSearchHighlightEnabled}
            disabled={childDisabled}
            onCheckedChange={setSearchHighlightEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <FormRow
          label="Hide donation banners"
          description="Remove known fundraising banners without hiding article notices."
          htmlFor={
            isPopup
              ? "wikipedia-hide-donations"
              : "options-wikipedia-hide-donations"
          }
        >
          <Switch
            id={
              isPopup
                ? "wikipedia-hide-donations"
                : "options-wikipedia-hide-donations"
            }
            checked={wikipediaHideDonationBannersEnabled}
            disabled={childDisabled}
            onCheckedChange={setHideDonationBannersEnabled}
            size={isPopup ? "sm" : "default"}
          />
        </FormRow>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Settings are shared across Wikipedia language editions.</span>
        </div>
      </SubOption>

      <AnimatedStatusText
        message={status?.message}
        isError={status?.isError}
        className={isPopup ? "text-xs" : "text-sm"}
      />
    </div>
  );
}
