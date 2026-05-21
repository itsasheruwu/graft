export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isYouTubeHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === "youtube.com" || host.endsWith(".youtube.com");
}

export function isYouTubeUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    return isYouTubeHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}
