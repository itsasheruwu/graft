import { describe, expect, it } from "vitest";
import { DEFAULT_X_QUIET_FEED_SETTINGS, isXHostname } from "@/lib/x-quiet-feed";

describe("X Quiet Feed settings", () => {
  it("is opt-in by default", () => {
    expect(DEFAULT_X_QUIET_FEED_SETTINGS.xQuietFeedEnabled).toBe(false);
  });

  it("only scopes the pack to X", () => {
    expect(isXHostname("x.com")).toBe(true);
    expect(isXHostname("www.x.com.")).toBe(true);
    expect(isXHostname("twitter.com")).toBe(false);
    expect(isXHostname("notx.com")).toBe(false);
  });
});
