import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { GalleryApp } from "@/gallery/GalleryApp";
import { syncExtensionThemeClass } from "@/lib/sync-extension-theme";
import "@/index.css";

syncExtensionThemeClass();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary title="Graft gallery error">
      <GalleryApp />
    </ErrorBoundary>
  </StrictMode>
);
