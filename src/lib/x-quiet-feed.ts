export const DEFAULT_X_QUIET_FEED_SETTINGS = {
  xQuietFeedEnabled: false,
};

export function isXHostname(hostname: string) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  return host === "x.com" || host === "www.x.com";
}
