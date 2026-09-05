import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PopupApp } from "@/popup/PopupApp";
import { syncExtensionThemeClass } from "@/lib/sync-extension-theme";
import "@/index.css";

syncExtensionThemeClass();
document.documentElement.setAttribute("data-graft-popup", "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div
      data-graft-menu-surface=""
      className="relative box-border w-[var(--graft-popup-width)] max-w-[var(--graft-popup-width)] overflow-hidden bg-background text-foreground antialiased"
    >
      <div className="max-h-[600px] overflow-x-hidden overflow-y-auto p-3">
        <ErrorBoundary title="Graft popup error">
          <PopupApp />
        </ErrorBoundary>
      </div>
    </div>
  </StrictMode>
);
