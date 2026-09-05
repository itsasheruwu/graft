import { describe, expect, it } from "vitest";

import {
  getWikipediaSearchTerm,
  isWikipediaArticleLocation,
  isWikipediaHostname,
  normalizeWikipediaReadingWidthPreset,
  WIKIPEDIA_READING_WIDTHS,
} from "@/lib/wikipedia-enhancements";

describe("wikipedia enhancement helpers", () => {
  it("recognizes Wikipedia hosts and subdomains", () => {
    expect(isWikipediaHostname("en.wikipedia.org")).toBe(true);
    expect(isWikipediaHostname("en.m.wikipedia.org")).toBe(true);
    expect(isWikipediaHostname("wikimedia.org")).toBe(false);
  });

  it("limits the pack to article routes", () => {
    const base = {
      hostname: "en.wikipedia.org",
      pathname: "/wiki/Example",
    };

    expect(isWikipediaArticleLocation(base)).toBe(true);
    expect(isWikipediaArticleLocation({ ...base, search: "?action=edit" })).toBe(
      false
    );
    expect(
      isWikipediaArticleLocation({ ...base, namespaceNumber: 1 })
    ).toBe(false);
    expect(
      isWikipediaArticleLocation({
        ...base,
        pathname: "/wiki/Talk:Example",
      })
    ).toBe(false);
  });

  it("normalizes width presets", () => {
    expect(normalizeWikipediaReadingWidthPreset("narrow")).toBe("narrow");
    expect(normalizeWikipediaReadingWidthPreset("unknown")).toBe("comfortable");
    expect(WIKIPEDIA_READING_WIDTHS).toEqual({
      narrow: "680px",
      comfortable: "760px",
      wide: "920px",
    });
  });

  it("reads bounded search terms", () => {
    expect(getWikipediaSearchTerm("?search=quantum%20foam")).toBe("quantum foam");
    expect(getWikipediaSearchTerm("?foo=bar")).toBeNull();
    expect(getWikipediaSearchTerm(`?search=${"x".repeat(121)}`)).toBeNull();
  });
});
