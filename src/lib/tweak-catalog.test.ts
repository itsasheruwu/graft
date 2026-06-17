import { describe, expect, it } from "vitest";

import {
  groupTweaksByCategory,
  listCategoryIds,
  listTweakIds,
  TWEAK_CATALOG,
} from "@/lib/tweak-catalog";

describe("groupTweaksByCategory", () => {
  it("groups tweaks into topic categories sorted A–Z", () => {
    const groups = groupTweaksByCategory();

    expect(groups.map((group) => group.label)).toEqual([
      "Appearance",
      "Customization",
      "Media",
      "Page tools",
      "YouTube",
    ]);
  });

  it("sorts tweaks A–Z within each category", () => {
    const groups = groupTweaksByCategory();
    const appearance = groups.find((group) => group.id === "appearance");

    expect(appearance?.tweaks.map((tweak) => tweak.name)).toEqual([
      "Force Dark Mode",
      "Theme Syncer",
    ]);

    const media = groups.find((group) => group.id === "media");
    expect(media?.tweaks.map((tweak) => tweak.name)).toEqual([
      "Asset Finder",
      "Sound Booster",
    ]);
  });

  it("lists tweak ids in grouped A–Z order", () => {
    expect(listTweakIds()).toEqual([
      "force-dark-mode",
      "theme-syncer",
      "graft-ai-rewriter",
      "asset-finder",
      "sound-booster",
      "element-selector",
      "youtube-auto-translate",
    ]);
  });

  it("lists category ids in grouped order", () => {
    expect(listCategoryIds()).toEqual([
      "appearance",
      "customization",
      "media",
      "page-tools",
      "youtube",
    ]);
  });

  it("includes every catalog tweak exactly once", () => {
    const groupedIds = listTweakIds();
    expect(groupedIds).toHaveLength(TWEAK_CATALOG.length);
    expect(new Set(groupedIds).size).toBe(TWEAK_CATALOG.length);
  });
});
