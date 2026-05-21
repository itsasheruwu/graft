/**
 * Normalize language codes for Google Translate API (service worker).
 */
export function normalizeGoogleTranslateLanguage(language: string): string {
  const normalized = String(language || "en").replace("_", "-").trim();
  if (normalized === "auto") {
    return "auto";
  }
  if (normalized.toLowerCase() === "zh-hant") {
    return "zh-TW";
  }
  if (normalized.toLowerCase() === "zh-hans") {
    return "zh-CN";
  }
  return normalized.split("-")[0].toLowerCase();
}

/**
 * Normalize language codes for in-page Translator / detection (content script).
 */
export function normalizeContentTranslateLanguage(language: string): string {
  const normalized = String(language || "en").replace("_", "-").trim();
  if (normalized.toLowerCase() === "zh-hant") {
    return "zh-Hant";
  }
  if (normalized.toLowerCase() === "zh-hans") {
    return "zh";
  }
  return normalized.split("-")[0].toLowerCase();
}

export function sameBaseLanguage(left: string, right: string): boolean {
  return (
    left.split("-")[0].toLowerCase() === right.split("-")[0].toLowerCase()
  );
}
