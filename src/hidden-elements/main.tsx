import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { HiddenElementsApp } from "@/hidden-elements/HiddenElementsApp";
import { syncExtensionThemeClass } from "@/lib/sync-extension-theme";
import "@/index.css";

syncExtensionThemeClass();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="min-h-screen bg-background text-foreground antialiased">
      <ErrorBoundary title="Hidden elements error">
        <HiddenElementsApp />
      </ErrorBoundary>
    </div>
  </StrictMode>
);
