import { describe, expect, it } from "vitest";
import { isYouTubeHostname, isYouTubeUrl, normalizeHostname } from "./youtube-host";

describe("isYouTubeHostname", () => {
  it("recognizes youtube hosts", () => {
    expect(isYouTubeHostname("www.youtube.com")).toBe(true);
    expect(isYouTubeHostname("music.youtube.com")).toBe(true);
    expect(isYouTubeHostname("example.com")).toBe(false);
  });
});

describe("isYouTubeUrl", () => {
  it("parses watch URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://example.com")).toBe(false);
  });
});

describe("normalizeHostname", () => {
  it("strips www", () => {
    expect(normalizeHostname("WWW.YouTube.COM")).toBe("youtube.com");
  });
});
