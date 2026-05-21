import { describe, expect, it } from "vitest";
import { flattenHiddenMap, normalizeDomainKey, signaturesMatch } from "./element-selector-hidden";

describe("flattenHiddenMap", () => {
  it("flattens per-domain lists", () => {
    const rows = flattenHiddenMap({
      "www.Example.com": [
        {
          tagName: "div",
          primarySelector: "#ad",
          selectorPath: "",
          id: "",
          classes: [],
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("example.com");
  });
});

describe("signaturesMatch", () => {
  it("matches primary selectors", () => {
    const a = {
      tagName: "div",
      primarySelector: "#x",
      selectorPath: "",
      id: "",
      classes: [],
    };
    const b = { ...a, selectorPath: "other" };
    expect(signaturesMatch(a, b)).toBe(true);
  });
});

describe("normalizeDomainKey", () => {
  it("normalizes hostnames", () => {
    expect(normalizeDomainKey("WWW.Site.COM")).toBe("site.com");
  });
});
