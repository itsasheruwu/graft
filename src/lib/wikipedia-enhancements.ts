export const WIKIPEDIA_READING_WIDTHS = {
  narrow: "680px",
  comfortable: "760px",
  wide: "920px",
} as const;

export type WikipediaReadingWidthPreset = keyof typeof WIKIPEDIA_READING_WIDTHS;

export const DEFAULT_WIKIPEDIA_ENHANCEMENTS_SETTINGS = {
  wikipediaEnhancementsEnabled: false,
  wikipediaReadingWidthEnabled: false,
  wikipediaReadingWidthPreset: "comfortable" as WikipediaReadingWidthPreset,
  wikipediaNavigationCleanupEnabled: false,
  wikipediaCollapseReferencesEnabled: false,
  wikipediaFloatingTocEnabled: false,
  wikipediaSearchHighlightEnabled: false,
  wikipediaHideDonationBannersEnabled: false,
};

export function normalizeWikipediaReadingWidthPreset(
  value: unknown
): WikipediaReadingWidthPreset {
  return value === "narrow" || value === "wide" ? value : "comfortable";
}

export function isWikipediaHostname(hostname: string) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  return host === "wikipedia.org" || host.endsWith(".wikipedia.org");
}

export function isWikipediaArticleLocation(input: {
  hostname: string;
  pathname: string;
  search?: string;
  namespaceNumber?: number | null;
}) {
  if (!isWikipediaHostname(input.hostname)) {
    return false;
  }

  if (!String(input.pathname || "").startsWith("/wiki/")) {
    return false;
  }

  const params = new URLSearchParams(input.search || "");
  if (
    params.has("action") ||
    params.has("diff") ||
    params.has("oldid") ||
    params.has("veaction")
  ) {
    return false;
  }

  if (typeof input.namespaceNumber === "number") {
    return input.namespaceNumber === 0;
  }

  let title = "";
  try {
    title = decodeURIComponent(String(input.pathname).slice("/wiki/".length));
  } catch (_error) {
    title = String(input.pathname).slice("/wiki/".length);
  }
  const namespace = title.split(":", 1)[0].toLowerCase();
  return ![
    "talk",
    "user",
    "wikipedia",
    "file",
    "mediawiki",
    "template",
    "help",
    "category",
    "portal",
    "book",
    "draft",
    "module",
    "timedtext",
    "special",
  ].includes(namespace);
}

export function getWikipediaSearchTerm(search: string) {
  const value = new URLSearchParams(search || "").get("search")?.trim() || "";
  return value.length > 0 && value.length <= 120 ? value : null;
}
