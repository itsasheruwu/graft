import type { ComponentType } from "react";

import { AssetFinderSettings } from "@/components/tweaks/asset-finder-settings";
import { ElementSelectorSettings } from "@/components/tweaks/element-selector-settings";
import { ForceDarkModeSettings } from "@/components/tweaks/force-dark-mode-settings";
import { GraftAiRewriterSettings } from "@/components/tweaks/graft-ai-rewriter-settings";
import { SoundBoosterSettings } from "@/components/tweaks/sound-booster-settings";
import { ThemeSyncerSettings } from "@/components/tweaks/theme-syncer-settings";
import { YoutubeAutoTranslateSettings } from "@/components/tweaks/youtube-auto-translate-settings";
import type { TweakBadgeState } from "@/hooks/use-tweak-status-badges";

export type TweakUiVariant = "popup" | "options";

export type TweakCategoryId =
  | "appearance"
  | "customization"
  | "media"
  | "page-tools"
  | "youtube";

export const TWEAK_CATEGORY_LABELS: Record<TweakCategoryId, string> = {
  appearance: "Appearance",
  customization: "Customization",
  media: "Media",
  "page-tools": "Page tools",
  youtube: "YouTube",
};

type TweakSettingsComponent = ComponentType<{ variant: TweakUiVariant }>;

export type TweakCatalogEntry = {
  id: string;
  name: string;
  category: TweakCategoryId;
  badgeKey: keyof TweakBadgeState;
  taglines: Record<TweakUiVariant, string>;
  Settings: TweakSettingsComponent;
};

export const TWEAK_CATALOG: TweakCatalogEntry[] = [
  {
    id: "force-dark-mode",
    name: "Force Dark Mode",
    category: "appearance",
    badgeKey: "forceDarkMode",
    taglines: {
      popup: "Darken sites without native themes",
      options: "Apply balanced dark styling to unsupported sites",
    },
    Settings: ForceDarkModeSettings,
  },
  {
    id: "theme-syncer",
    name: "Theme Syncer",
    category: "appearance",
    badgeKey: "themeSyncer",
    taglines: {
      popup: "Match sites to system light / dark",
      options: "Match page themes to your device appearance",
    },
    Settings: ThemeSyncerSettings,
  },
  {
    id: "graft-ai-rewriter",
    name: "AI Rewriter",
    category: "customization",
    badgeKey: "graftAiRewriter",
    taglines: {
      popup: "Reshape the current site",
      options: "Reflow, restyle, and save site-specific versions",
    },
    Settings: GraftAiRewriterSettings,
  },
  {
    id: "asset-finder",
    name: "Asset Finder",
    category: "media",
    badgeKey: "assetFinder",
    taglines: {
      popup: "Browse images, media, and page assets",
      options: "Browse visible media assets on the current page",
    },
    Settings: AssetFinderSettings,
  },
  {
    id: "sound-booster",
    name: "Sound Booster",
    category: "media",
    badgeKey: "soundBooster",
    taglines: {
      popup: "Raise HTML5 media volume",
      options: "Boost regular HTML5 audio and video volume",
    },
    Settings: SoundBoosterSettings,
  },
  {
    id: "element-selector",
    name: "Element Selector",
    category: "page-tools",
    badgeKey: "elementSelector",
    taglines: {
      popup: "Hide/inspect elements with an in-page selector",
      options: "Hide and inspect page elements with hover actions",
    },
    Settings: ElementSelectorSettings,
  },
  {
    id: "youtube-auto-translate",
    name: "YouTube Auto Translation",
    category: "youtube",
    badgeKey: "youtubeAutoTranslate",
    taglines: {
      popup: "Translate video metadata",
      options: "Translate titles and descriptions into your browser language",
    },
    Settings: YoutubeAutoTranslateSettings,
  },
];

export type TweakCategoryGroup = {
  id: TweakCategoryId;
  label: string;
  tweaks: TweakCatalogEntry[];
};

function compareLabels(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function groupTweaksByCategory(
  entries: TweakCatalogEntry[] = TWEAK_CATALOG
): TweakCategoryGroup[] {
  const byCategory = new Map<TweakCategoryId, TweakCatalogEntry[]>();

  for (const entry of entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  return (Object.keys(TWEAK_CATEGORY_LABELS) as TweakCategoryId[])
    .map((id) => ({
      id,
      label: TWEAK_CATEGORY_LABELS[id],
      tweaks: [...(byCategory.get(id) ?? [])].sort((a, b) =>
        compareLabels(a.name, b.name)
      ),
    }))
    .filter((group) => group.tweaks.length > 0)
    .sort((a, b) => compareLabels(a.label, b.label));
}

export function listTweakIds(
  entries: TweakCatalogEntry[] = TWEAK_CATALOG
): string[] {
  return groupTweaksByCategory(entries).flatMap((group) =>
    group.tweaks.map((tweak) => tweak.id)
  );
}
