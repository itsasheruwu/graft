import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PopupApp } from "@/popup/PopupApp";
import { syncExtensionThemeClass } from "@/lib/sync-extension-theme";
import "@/index.css";

syncExtensionThemeClass();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="box-border w-[300px] bg-background p-3 text-foreground antialiased">
      <ErrorBoundary title="Graft popup error">
        <PopupApp />
      </ErrorBoundary>
    </div>
  </StrictMode>
);
