import { describe, expect, it } from "vitest";
import {
  GRAFT_AI_ALLOWED_STYLE_PROPERTIES,
  flattenGraftAiRecipeMap,
  validateGraftAiRecipe,
} from "@/lib/graft-ai-recipe";

const target = {
  selectorPath: "main > section:nth-of-type(1)",
  primarySelector: "section.hero",
  tagName: "section",
  id: "",
  classes: ["hero"],
  sourceUrl: "https://example.com/",
};

describe("validateGraftAiRecipe", () => {
  it("accepts constrained safe recipe actions", () => {
    const result = validateGraftAiRecipe({
      version: 1,
      domain: "www.example.com",
      prompt: "make it calmer",
      summary: "Calmer page",
      actions: [
        {
          type: "theme",
          target: { ...target, selectorPath: "html", primarySelector: "html", tagName: "html" },
          reason: "Apply a cohesive full-page theme",
          theme: {
            preset: "modern",
            mode: "preserve",
            palette: "green",
            density: "comfortable",
            radius: "soft",
            contrast: "normal",
          },
        },
        { type: "hide", target, reason: "Remove distracting hero block" },
        {
          type: "textRewrite",
          target,
          reason: "Make the heading direct",
          newText: "Welcome back",
        },
        {
          type: "style",
          target,
          reason: "Soften the section",
          styles: {
            color: "#111",
            backgroundColor: "#fff",
          },
        },
        {
          type: "move",
          target,
          anchor: { ...target, primarySelector: "main" },
          position: "end",
          reason: "Move it below the main content",
        },
        {
          type: "shortcut",
          target,
          combo: "ctrl+k",
          behavior: "focus",
          reason: "Make search faster",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipe.domain).toBe("example.com");
      expect(result.recipe.actions).toHaveLength(6);
    }
  });

  it("rejects unsafe or empty recipes", () => {
    expect(
      validateGraftAiRecipe({
        version: 1,
        domain: "example.com",
        actions: [
          {
            type: "script",
            target,
            reason: "Run arbitrary code",
            code: "alert(1)",
          },
        ],
      }).ok
    ).toBe(false);
  });

  it("filters unsafe style properties and css urls", () => {
    const result = validateGraftAiRecipe({
      version: 1,
      domain: "example.com",
      summary: "Restyle",
      actions: [
        {
          type: "style",
          target,
          reason: "Use safe styles only",
          styles: {
            color: "red",
            backgroundImage: "url(https://evil.test/a.png)",
            backgroundColor: "url(javascript:alert(1))",
          },
        },
      ],
    });

    expect(GRAFT_AI_ALLOWED_STYLE_PROPERTIES).toContain("color");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipe.actions[0]).toMatchObject({
        type: "style",
        styles: { color: "red" },
      });
    }
  });

  it("rejects arbitrary theme values", () => {
    const result = validateGraftAiRecipe({
      version: 1,
      domain: "example.com",
      actions: [
        {
          type: "theme",
          target,
          reason: "Use a random stylesheet",
          theme: {
            preset: "modern",
            mode: "preserve",
            palette: "neon-css-url",
            density: "comfortable",
            radius: "soft",
            contrast: "normal",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
  });
});

describe("flattenGraftAiRecipeMap", () => {
  it("normalizes per-domain recipe lists", () => {
    const rows = flattenGraftAiRecipeMap({
      "www.example.com": [
        {
          version: 1,
          prompt: "hide hero",
          summary: "Hide hero",
          actions: [{ type: "hide", target, reason: "Too large" }],
        },
      ],
      invalid: "nope",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("example.com");
    expect(rows[0].enabled).toBe(true);
  });
});
