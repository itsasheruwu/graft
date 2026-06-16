import * as React from "react";

import { GRAFT_UI_ROOT_ATTR, type ExtensionSurfaceVariant } from "@/lib/extension-ui";
import { cn } from "@/lib/utils";

type ExtensionSurfaceProps = React.ComponentProps<"div"> & {
  /**
   * `popup` — toolbar popup (300px).
   * `sub-options` — nested accordion panel inside popup (~244px).
   * `options` — full settings page shell.
   * `panel` — compact slide-out / bottom sheet host.
   * `content-script` — isolated from host page CSS (use inside shadow DOM when possible).
   */
  variant?: ExtensionSurfaceVariant;
};

function surfaceWidthClass(variant: ExtensionSurfaceVariant) {
  switch (variant) {
    case "popup":
    case "panel":
      return "w-[300px] max-w-[300px]";
    case "sub-options":
      return "w-[244px] max-w-[244px]";
    case "options":
      return "mx-auto w-full max-w-[42rem]";
    case "content-script":
      return "w-full max-w-none";
    default:
      return "";
  }
}

/**
 * Root wrapper for all extension UI. Keeps typography, colors, and sizing
 * consistent across popup, options, gallery, and injected panels.
 *
 * For content scripts: mount inside an open shadow root and set
 * `variant="content-script"` so `[data-graft-ui]` isolation rules apply.
 */
function ExtensionSurface({
  variant = "options",
  className,
  children,
  ...props
}: ExtensionSurfaceProps) {
  return (
    <div
      {...{ [GRAFT_UI_ROOT_ATTR]: "" }}
      data-surface={variant}
      className={cn(
        "box-border bg-background font-sans text-foreground antialiased",
        surfaceWidthClass(variant),
        variant === "content-script" && "graft-ui-isolated",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { ExtensionSurface };
