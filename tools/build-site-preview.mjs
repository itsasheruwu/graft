import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(root, "website/preview");
await build({
  configFile: false,
  root: path.join(root, "tools/site-preview"),
  base: "./",
  plugins: [
    {
      name: "scan-authentic-ui-classes",
      enforce: "pre",
      load(id) {
        if (id === path.join(root, "src/index.css")) {
          return (
            readFileSync(id, "utf8") +
            '\n@source "' +
            path.join(root, "src") +
            '";\n'
          );
        }
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.join(root, "src") } },
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: false,
    target: "es2022",
  },
});
const hashes = {};
function record(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) record(filename);
    else if (/\.(tsx?|css)$/.test(item.name) && !item.name.includes(".test.")) {
      hashes[path.relative(root, filename)] = createHash("sha256")
        .update(readFileSync(filename))
        .digest("hex");
    }
  }
}
record(path.join(root, "src"));
writeFileSync(
  path.join(outDir, "source-snapshot.json"),
  JSON.stringify(
    {
      description:
        "Built directly from the Graft working-tree UI. Browser APIs are replaced with isolated, in-memory demo adapters.",
      sourceHashes: hashes,
    },
    null,
    2,
  ) + "\n",
);
