import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import {
  buildContentScripts,
  listEntrypointCopyPaths,
  loadRegistry,
} from "./src/build/registry-build.mjs";

function extensionManifestPlugin() {
  return {
    name: "extension-manifest-and-assets",
    closeBundle() {
      const root = __dirname;
      const dist = path.join(root, "dist");
      const registry = loadRegistry();

      for (const filePath of listEntrypointCopyPaths(registry)) {
        const dest = path.join(dist, filePath);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(path.join(root, filePath), dest);
      }

      cpSync(
        path.join(root, "src", "assets", "icons"),
        path.join(dist, "src", "assets", "icons"),
        { recursive: true }
      );

      const manifestSrc = readFileSync(
        path.join(root, "manifest.json"),
        "utf8"
      );
      const manifest = JSON.parse(manifestSrc) as Record<string, unknown>;

      manifest.action = {
        ...(manifest.action as object),
        default_popup: "popup.html",
      };
      manifest.options_page = "options.html";
      manifest.background = {
        service_worker: "src/background/service_worker.js",
      };
      manifest.content_scripts = buildContentScripts(registry);

      if (registry.commands) {
        const commands: Record<
          string,
          { description: string; suggested_key?: { default: string; mac?: string } }
        > = {};
        for (const [name, spec] of Object.entries(
          registry.commands as Record<
            string,
            { description: string; suggestedKey?: { default: string; mac?: string } }
          >
        )) {
          commands[name] = {
            description: spec.description,
            suggested_key: spec.suggestedKey
              ? {
                  default: spec.suggestedKey.default,
                  mac: spec.suggestedKey.mac ?? spec.suggestedKey.default,
                }
              : undefined,
          };
        }
        manifest.commands = commands;
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
  base: "./",
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
        "edited-list": path.resolve(__dirname, "edited-list.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
