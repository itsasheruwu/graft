import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "@/popup/PopupApp";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="w-[360px] border-x border-border bg-background p-3">
      <PopupApp />
    </div>
  </StrictMode>
);
