export const SOUND_BOOSTER_MIN_GAIN = 1;
export const SOUND_BOOSTER_MAX_GAIN = 4;
export const SOUND_BOOSTER_DEFAULT_GAIN = 1.5;

export function normalizeDomainKey(value: string) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
}

export function normalizeDomainList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeDomainKey(String(entry))).filter(Boolean);
}

export function isHostnameBlocked(hostname: string, blockedDomains: unknown) {
  const host = normalizeDomainKey(hostname);
  if (!host) {
    return false;
  }

  return normalizeDomainList(blockedDomains).some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function isNativeDarkModeHostname(hostname: string) {
  const host = normalizeDomainKey(hostname);
  if (!host) {
    return false;
  }

  const exactOrSubdomain = [
    "github.com",
    "developer.mozilla.org",
    "wikipedia.org",
    "wikimedia.org",
    "youtube.com",
    "reddit.com",
    "x.com",
    "twitter.com",
    "facebook.com",
    "instagram.com",
    "discord.com",
    "notion.so",
    "figma.com",
    "openai.com",
    "chatgpt.com",
    "stackoverflow.com",
    "stackexchange.com",
  ];

  if (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    /^google\.[a-z.]+$/.test(host) ||
    /\.google\.[a-z.]+$/.test(host)
  ) {
    return true;
  }

  return exactOrSubdomain.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function clampSoundBoosterGain(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return SOUND_BOOSTER_DEFAULT_GAIN;
  }

  const clamped = Math.min(
    SOUND_BOOSTER_MAX_GAIN,
    Math.max(SOUND_BOOSTER_MIN_GAIN, numeric)
  );
  return Math.round(clamped * 10) / 10;
}
