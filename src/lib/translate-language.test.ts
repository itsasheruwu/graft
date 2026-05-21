import { describe, expect, it } from "vitest";
import {
  normalizeContentTranslateLanguage,
  normalizeGoogleTranslateLanguage,
  sameBaseLanguage,
} from "./translate-language";

describe("normalizeGoogleTranslateLanguage", () => {
  it("maps zh variants for Google API", () => {
    expect(normalizeGoogleTranslateLanguage("zh-Hant")).toBe("zh-TW");
    expect(normalizeGoogleTranslateLanguage("zh-Hans")).toBe("zh-CN");
    expect(normalizeGoogleTranslateLanguage("auto")).toBe("auto");
  });
});

describe("normalizeContentTranslateLanguage", () => {
  it("maps zh variants for in-page detection", () => {
    expect(normalizeContentTranslateLanguage("zh-Hant")).toBe("zh-Hant");
    expect(normalizeContentTranslateLanguage("zh-Hans")).toBe("zh");
  });
});

describe("sameBaseLanguage", () => {
  it("compares base language codes", () => {
    expect(sameBaseLanguage("en-US", "en-GB")).toBe(true);
    expect(sameBaseLanguage("en", "fr")).toBe(false);
  });
});
