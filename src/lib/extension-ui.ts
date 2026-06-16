/** Shared layout constants for extension surfaces (popup, options, injected panels). */
export const EXTENSION_POPUP_WIDTH = 300;
export const EXTENSION_SUB_OPTION_WIDTH = 244;
export const EXTENSION_OPTIONS_MAX_WIDTH = 672;
export const EXTENSION_GALLERY_MAX_WIDTH = 960;

/** Root attribute used to scope styles when UI is injected into host pages. */
export const GRAFT_UI_ROOT_ATTR = "data-graft-ui";

export type ExtensionSurfaceVariant =
  | "popup"
  | "sub-options"
  | "options"
  | "panel"
  | "content-script";

export const extensionSurfaceWidths: Record<
  Exclude<ExtensionSurfaceVariant, "content-script">,
  number | "full"
> = {
  popup: EXTENSION_POPUP_WIDTH,
  "sub-options": EXTENSION_SUB_OPTION_WIDTH,
  options: EXTENSION_OPTIONS_MAX_WIDTH,
  panel: EXTENSION_POPUP_WIDTH,
};
