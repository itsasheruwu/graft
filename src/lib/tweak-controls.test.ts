import {
  SOUND_BOOSTER_DEFAULT_GAIN,
  clampSoundBoosterGain,
  isHostnameBlocked,
  isNativeDarkModeHostname,
  normalizeDomainKey,
  normalizeDomainList,
} from "@/lib/tweak-controls";
import { describe, expect, it } from "vitest";

describe("tweak control helpers", () => {
  it("normalizes domain keys from hostnames and URLs", () => {
    expect(normalizeDomainKey("WWW.Example.COM")).toBe("example.com");
    expect(normalizeDomainKey("https://www.example.com/path")).toBe(
      "example.com"
    );
    expect(normalizeDomainKey("sub.example.com:8080")).toBe("sub.example.com");
  });

  it("normalizes domain blocklists", () => {
    expect(
      normalizeDomainList(["https://www.example.com/a", "", "LOCALHOST:3000"])
    ).toEqual(["example.com", "localhost"]);
  });

  it("matches exact domains and subdomains", () => {
    expect(isHostnameBlocked("example.com", ["example.com"])).toBe(true);
    expect(isHostnameBlocked("news.example.com", ["example.com"])).toBe(true);
    expect(isHostnameBlocked("notexample.com", ["example.com"])).toBe(false);
  });

  it("recognizes known native dark mode hosts", () => {
    expect(isNativeDarkModeHostname("google.com")).toBe(true);
    expect(isNativeDarkModeHostname("www.google.com")).toBe(true);
    expect(isNativeDarkModeHostname("google.co.uk")).toBe(true);
    expect(isNativeDarkModeHostname("mail.google.com")).toBe(true);
    expect(isNativeDarkModeHostname("github.com")).toBe(true);
    expect(isNativeDarkModeHostname("en.wikipedia.org")).toBe(true);
    expect(isNativeDarkModeHostname("developer.mozilla.org")).toBe(true);
    expect(isNativeDarkModeHostname("stackoverflow.com")).toBe(true);
    expect(isNativeDarkModeHostname("example.com")).toBe(false);
  });

  it("clamps sound booster gain to the supported range", () => {
    expect(clampSoundBoosterGain(0)).toBe(1);
    expect(clampSoundBoosterGain(2.26)).toBe(2.3);
    expect(clampSoundBoosterGain(9)).toBe(4);
    expect(clampSoundBoosterGain("bad")).toBe(SOUND_BOOSTER_DEFAULT_GAIN);
  });
});
