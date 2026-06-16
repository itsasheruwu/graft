export type SrcsetCandidate = {
  url: string;
  width: number;
};

export function parseAssetSrcset(value: string | null | undefined): SrcsetCandidate[] {
  return String(value || "")
    .split(/,\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const pieces = part.split(/\s+/);
      const descriptor = pieces[1] || "";
      const width = descriptor.endsWith("w") ? Number.parseInt(descriptor, 10) : 0;
      return {
        url: pieces[0] || "",
        width: Number.isFinite(width) ? width : 0,
      };
    })
    .filter((candidate) => candidate.url.length > 0);
}

export function normalizeAssetUrl(rawUrl: string, baseUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value || value === "none" || value.startsWith("blob:")) {
    return "";
  }
  if (value.startsWith("data:image/svg+xml")) {
    return value;
  }
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return "";
  }
}

export function detectAssetExtension(url: string, fallbackType = "asset"): string {
  if (url.startsWith("data:image/svg+xml")) {
    return "svg";
  }
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    if (match) {
      return match[1] === "jpeg" ? "jpg" : match[1];
    }
  } catch {
    return fallbackType === "svg" ? "svg" : "asset";
  }
  return fallbackType === "svg" ? "svg" : "asset";
}

export type AssetKind = "image" | "svg" | "video" | "audio" | "icon";

export function detectAssetType(url: string, sourceLabel: string): AssetKind {
  const extension = detectAssetExtension(url);
  if (sourceLabel.includes("icon") || extension === "ico") {
    return "icon";
  }
  if (extension === "svg") {
    return "svg";
  }
  if (["mp4", "webm", "mov", "m4v", "ogg"].includes(extension)) {
    return "video";
  }
  if (["mp3", "wav", "m4a", "aac", "flac"].includes(extension)) {
    return "audio";
  }
  return "image";
}

export function dedupeAssetUrls(urls: string[], baseUrl: string): string[] {
  const seen = new Set<string>();
  for (const url of urls) {
    const normalized = normalizeAssetUrl(url, baseUrl);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return [...seen];
}

export function isInlineSvgSpriteReference(url: string): boolean {
  if (!String(url || "").startsWith("data:image/svg+xml")) {
    return false;
  }

  let decoded = "";
  try {
    decoded = decodeURIComponent(String(url).split(",").slice(1).join(","));
  } catch {
    decoded = String(url);
  }

  return /<use\b/i.test(decoded) && /\bhref=|xlink:href=/i.test(decoded);
}
