import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "@/popup/PopupApp";
import "@/index.css";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="min-h-screen bg-background p-4 text-foreground">
      <div className="w-[320px] rounded-lg border border-border p-3 shadow-sm">
        <PopupApp />
      </div>
    </div>
  </StrictMode>
);
