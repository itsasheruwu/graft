import { installPreviewAdapter } from "./preview-adapter";

async function main() {
  await installPreviewAdapter();
  const view = new URLSearchParams(location.search).get("view");
  if (view === "options") {
    await import("../../src/options/main");
  } else if (view === "edited-list") {
    await import("../../src/hidden-elements/main");
  } else {
    // The shipped popup entry owns every element, token, font, and interaction.
    await import("../../src/popup/main");
  }
}
void main();
