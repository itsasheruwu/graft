import { describe, expect, it } from "vitest";
import {
  dedupeAssetUrls,
  detectAssetExtension,
  detectAssetType,
  isInlineSvgSpriteReference,
  normalizeAssetUrl,
  parseAssetSrcset,
} from "@/lib/asset-finder-core";

const BASE_URL = "https://example.com/gallery/page.html";

describe("asset finder core helpers", () => {
  it("normalizes relative URLs and rejects unsupported asset URLs", () => {
    expect(normalizeAssetUrl("../img/photo.png?size=2", BASE_URL)).toBe(
      "https://example.com/img/photo.png?size=2"
    );
    expect(normalizeAssetUrl("blob:https://example.com/123", BASE_URL)).toBe("");
    expect(normalizeAssetUrl("", BASE_URL)).toBe("");
  });

  it("parses srcset candidates with widths", () => {
    expect(parseAssetSrcset("small.jpg 320w, /large.webp 1200w, icon.svg 2x")).toEqual([
      { url: "small.jpg", width: 320 },
      { url: "/large.webp", width: 1200 },
      { url: "icon.svg", width: 0 },
    ]);
  });

  it("keeps data URL commas inside srcset URLs", () => {
    const srcset = "data:image/svg+xml,%3Csvg%3E%3C/svg%3E 180w, /fallback.png 360w";
    expect(parseAssetSrcset(srcset)).toEqual([
      { url: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E", width: 180 },
      { url: "/fallback.png", width: 360 },
    ]);
  });

  it("detects extensions and normalizes jpeg", () => {
    expect(detectAssetExtension("https://example.com/a/photo.jpeg?x=1")).toBe("jpg");
    expect(detectAssetExtension("data:image/svg+xml;charset=utf-8,%3Csvg%3E")).toBe("svg");
    expect(detectAssetExtension("https://example.com/no-extension")).toBe("asset");
  });

  it("classifies common visible media types", () => {
    expect(detectAssetType("https://example.com/logo.svg", "img")).toBe("svg");
    expect(detectAssetType("https://example.com/favicon.ico", "page icon")).toBe("icon");
    expect(detectAssetType("https://example.com/clip.webm", "video source")).toBe("video");
    expect(detectAssetType("https://example.com/song.m4a", "audio source")).toBe("audio");
    expect(detectAssetType("https://example.com/bg.avif", "background image")).toBe("image");
  });

  it("dedupes normalized absolute URLs", () => {
    expect(dedupeAssetUrls(["/a.png", "https://example.com/a.png", "./b.png"], BASE_URL)).toEqual([
      "https://example.com/a.png",
      "https://example.com/gallery/b.png",
    ]);
  });

  it("detects standalone inline SVGs that only reference page sprite symbols", () => {
    const spriteSvg = encodeURIComponent(
      '<svg width="20" height="20" aria-hidden="true"><use href="/cdn/assets/sprites-core.svg#search" fill="currentColor"></use></svg>'
    );
    const shapeSvg = encodeURIComponent(
      '<svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="currentColor"></circle></svg>'
    );

    expect(isInlineSvgSpriteReference(`data:image/svg+xml;charset=utf-8,${spriteSvg}`)).toBe(true);
    expect(isInlineSvgSpriteReference(`data:image/svg+xml;charset=utf-8,${shapeSvg}`)).toBe(false);
    expect(isInlineSvgSpriteReference("https://example.com/icon.svg")).toBe(false);
  });
});
