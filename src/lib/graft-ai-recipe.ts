import {
  normalizeDomainKey,
  type HiddenElementSignature,
} from "@/lib/element-selector-hidden";

export const GRAFT_AI_RECIPES_KEY = "graftAiRecipesByDomain";
export const GRAFT_AI_HELPER_PORT_KEY = "graftAiHelperPort";
export const GRAFT_AI_HELPER_TOKEN_KEY = "graftAiHelperToken";

export const GRAFT_AI_DEFAULT_HELPER_PORT = 27491;

export const GRAFT_AI_ALLOWED_STYLE_PROPERTIES = [
  "backgroundColor",
  "border",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "color",
  "display",
  "fontSize",
  "fontWeight",
  "gap",
  "lineHeight",
  "margin",
  "marginBottom",
  "marginTop",
  "maxWidth",
  "opacity",
  "padding",
  "paddingBottom",
  "paddingTop",
  "transform",
] as const;

const ALLOWED_STYLE_SET = new Set<string>(GRAFT_AI_ALLOWED_STYLE_PROPERTIES);

const ALLOWED_SHORTCUT_BEHAVIORS = new Set([
  "click",
  "focus",
  "toggleHidden",
  "hide",
]);

const ALLOWED_MOVE_POSITIONS = new Set(["before", "after", "start", "end"]);
const ALLOWED_THEME_PRESETS = new Set(["modern", "calm", "minimal", "editorial", "focus"]);
const ALLOWED_THEME_MODES = new Set(["preserve", "light", "dark"]);
const ALLOWED_THEME_PALETTES = new Set(["slate", "blue", "green", "violet", "rose", "amber"]);
const ALLOWED_THEME_DENSITIES = new Set(["compact", "comfortable", "spacious"]);
const ALLOWED_THEME_RADII = new Set(["subtle", "soft", "round"]);
const ALLOWED_THEME_CONTRASTS = new Set(["normal", "high"]);

export type GraftAiTheme = {
  preset: "modern" | "calm" | "minimal" | "editorial" | "focus";
  mode: "preserve" | "light" | "dark";
  palette: "slate" | "blue" | "green" | "violet" | "rose" | "amber";
  density: "compact" | "comfortable" | "spacious";
  radius: "subtle" | "soft" | "round";
  contrast: "normal" | "high";
};

export type GraftAiRecipeActionBase = {
  id?: string;
  reason: string;
  target: HiddenElementSignature;
};

export type GraftAiThemeAction = GraftAiRecipeActionBase & {
  type: "theme";
  theme: GraftAiTheme;
};

export type GraftAiHideAction = GraftAiRecipeActionBase & {
  type: "hide";
};

export type GraftAiTextRewriteAction = GraftAiRecipeActionBase & {
  type: "textRewrite";
  newText: string;
};

export type GraftAiStyleAction = GraftAiRecipeActionBase & {
  type: "style";
  styles: Partial<Record<(typeof GRAFT_AI_ALLOWED_STYLE_PROPERTIES)[number], string>>;
};

export type GraftAiMoveAction = GraftAiRecipeActionBase & {
  type: "move";
  anchor: HiddenElementSignature;
  position: "before" | "after" | "start" | "end";
};

export type GraftAiShortcutAction = GraftAiRecipeActionBase & {
  type: "shortcut";
  combo: string;
  behavior: "click" | "focus" | "toggleHidden" | "hide";
};

export type GraftAiRecipeAction =
  | GraftAiThemeAction
  | GraftAiHideAction
  | GraftAiTextRewriteAction
  | GraftAiStyleAction
  | GraftAiMoveAction
  | GraftAiShortcutAction;

export type GraftAiRecipe = {
  id: string;
  version: 1;
  domain: string;
  prompt: string;
  summary: string;
  actions: GraftAiRecipeAction[];
  createdAt: string;
  sourceUrl: string;
  enabled: boolean;
};

export type GraftAiRecipeRow = GraftAiRecipe & {
  domain: string;
};

type ValidationResult =
  | { ok: true; recipe: GraftAiRecipe }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeSignature(value: unknown): HiddenElementSignature | null {
  if (!isRecord(value)) {
    return null;
  }

  const classes = Array.isArray(value.classes)
    ? value.classes.filter(Boolean).map(String).slice(0, 16)
    : [];
  const signature = {
    selectorPath: cleanString(value.selectorPath, 600),
    primarySelector: cleanString(value.primarySelector, 300),
    tagName: cleanString(value.tagName, 80).toLowerCase(),
    id: cleanString(value.id, 160),
    classes,
    sourceUrl: cleanString(value.sourceUrl, 1000) || undefined,
  };

  if (!signature.selectorPath && !signature.primarySelector && !signature.tagName) {
    return null;
  }

  return signature;
}

function normalizeStyleMap(value: unknown): GraftAiStyleAction["styles"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const styles: GraftAiStyleAction["styles"] = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!ALLOWED_STYLE_SET.has(key)) {
      continue;
    }
    const styleValue = cleanString(raw, 180);
    if (!styleValue || /url\s*\(|expression\s*\(|javascript:/i.test(styleValue)) {
      continue;
    }
    styles[key as keyof GraftAiStyleAction["styles"]] = styleValue;
  }

  return Object.keys(styles).length > 0 ? styles : null;
}

function normalizeTheme(value: unknown): GraftAiTheme | null {
  if (!isRecord(value)) {
    return null;
  }

  const preset = cleanString(value.preset, 24);
  const mode = cleanString(value.mode, 24);
  const palette = cleanString(value.palette, 24);
  const density = cleanString(value.density, 24);
  const radius = cleanString(value.radius, 24);
  const contrast = cleanString(value.contrast, 24);

  if (
    !ALLOWED_THEME_PRESETS.has(preset) ||
    !ALLOWED_THEME_MODES.has(mode) ||
    !ALLOWED_THEME_PALETTES.has(palette) ||
    !ALLOWED_THEME_DENSITIES.has(density) ||
    !ALLOWED_THEME_RADII.has(radius) ||
    !ALLOWED_THEME_CONTRASTS.has(contrast)
  ) {
    return null;
  }

  return {
    preset: preset as GraftAiTheme["preset"],
    mode: mode as GraftAiTheme["mode"],
    palette: palette as GraftAiTheme["palette"],
    density: density as GraftAiTheme["density"],
    radius: radius as GraftAiTheme["radius"],
    contrast: contrast as GraftAiTheme["contrast"],
  };
}

function normalizeAction(value: unknown): GraftAiRecipeAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  const target = normalizeSignature(value.target);
  const reason = cleanString(value.reason, 220);
  if (!target || !reason) {
    return null;
  }

  const base = {
    id: cleanString(value.id, 120) || undefined,
    reason,
    target,
  };

  if (type === "theme") {
    const theme = normalizeTheme(value.theme);
    return theme ? { ...base, type, theme } : null;
  }
  if (type === "hide") {
    return { ...base, type };
  }
  if (type === "textRewrite") {
    const newText = cleanString(value.newText, 5000);
    return newText ? { ...base, type, newText } : null;
  }
  if (type === "style") {
    const styles = normalizeStyleMap(value.styles);
    return styles ? { ...base, type, styles } : null;
  }
  if (type === "move") {
    const anchor = normalizeSignature(value.anchor);
    const position = cleanString(value.position, 24);
    if (!anchor || !ALLOWED_MOVE_POSITIONS.has(position)) {
      return null;
    }
    return {
      ...base,
      type,
      anchor,
      position: position as GraftAiMoveAction["position"],
    };
  }
  if (type === "shortcut") {
    const combo = cleanString(value.combo, 80);
    const behavior = cleanString(value.behavior, 80);
    if (!combo || !ALLOWED_SHORTCUT_BEHAVIORS.has(behavior)) {
      return null;
    }
    return {
      ...base,
      type,
      combo,
      behavior: behavior as GraftAiShortcutAction["behavior"],
    };
  }

  return null;
}

export function validateGraftAiRecipe(
  value: unknown,
  fallback?: { domain?: string; prompt?: string; sourceUrl?: string }
): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Recipe must be an object." };
  }

  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeAction).filter((action): action is GraftAiRecipeAction => Boolean(action))
    : [];
  if (actions.length === 0) {
    return { ok: false, error: "Recipe must include at least one safe action." };
  }

  const domain = normalizeDomainKey(
    cleanString(value.domain, 255) || fallback?.domain || ""
  );
  if (!domain) {
    return { ok: false, error: "Recipe is missing a domain." };
  }

  return {
    ok: true,
    recipe: {
      id:
        cleanString(value.id, 120) ||
        `graft-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version: 1,
      domain,
      prompt: cleanString(value.prompt, 2000) || fallback?.prompt || "",
      summary: cleanString(value.summary, 500) || "AI rewrite",
      actions: actions.slice(0, 40),
      createdAt: cleanString(value.createdAt, 80) || new Date().toISOString(),
      sourceUrl: cleanString(value.sourceUrl, 1000) || fallback?.sourceUrl || "",
      enabled: value.enabled === false ? false : true,
    },
  };
}

export function normalizeGraftAiRecipeMap(
  raw: Record<string, unknown> | undefined
): Record<string, GraftAiRecipe[]> {
  const output: Record<string, GraftAiRecipe[]> = {};
  if (!raw || typeof raw !== "object") {
    return output;
  }

  for (const [domainKey, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const domain = normalizeDomainKey(domainKey);
    const recipes: GraftAiRecipe[] = [];
    for (const entry of value) {
      const result = validateGraftAiRecipe(entry, { domain });
      if (result.ok) {
        recipes.push(result.recipe);
      }
    }
    if (recipes.length > 0) {
      output[domain] = recipes;
    }
  }

  return output;
}

export function flattenGraftAiRecipeMap(
  raw: Record<string, unknown> | undefined
): GraftAiRecipeRow[] {
  return Object.entries(normalizeGraftAiRecipeMap(raw)).flatMap(
    ([domain, recipes]) => recipes.map((recipe) => ({ ...recipe, domain }))
  );
}

export function graftAiRecipeRowKey(recipe: GraftAiRecipe): string {
  return `${recipe.domain}|${recipe.id}|${recipe.createdAt}`;
}
