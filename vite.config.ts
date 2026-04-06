import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";

function extensionManifestPlugin() {
  return {
    name: "extension-manifest-and-assets",
    closeBundle() {
      const root = __dirname;
      const dist = path.join(root, "dist");
      mkdirSync(path.join(dist, "src", "background"), { recursive: true });
      mkdirSync(path.join(dist, "src", "tweaks", "theme-syncer"), {
        recursive: true,
      });

      cpSync(
        path.join(root, "src", "background", "service_worker.js"),
        path.join(dist, "src", "background", "service_worker.js")
      );
      cpSync(
        path.join(root, "src", "tweaks", "theme-syncer", "page.js"),
        path.join(dist, "src", "tweaks", "theme-syncer", "page.js")
      );
      cpSync(
        path.join(root, "src", "tweaks", "theme-syncer", "bridge.js"),
        path.join(dist, "src", "tweaks", "theme-syncer", "bridge.js")
      );

      const manifestSrc = readFileSync(
        path.join(root, "manifest.json"),
        "utf8"
      );
      const manifest = JSON.parse(manifestSrc) as {
        action?: { default_popup: string };
        options_page?: string;
        background?: { service_worker: string };
        content_scripts?: Array<{ js: string[] }>;
      };

      manifest.action = {
        ...manifest.action,
        default_popup: "popup.html",
      };
      manifest.options_page = "options.html";
      if (manifest.background?.service_worker) {
        manifest.background = {
          service_worker: "src/background/service_worker.js",
        };
      }

      writeFileSync(
        path.join(dist, "manifest.json"),
        JSON.stringify(manifest, null, 2) + "\n",
        "utf8"
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), extensionManifestPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "popup.html"),
        options: path.resolve(__dirname, "options.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
