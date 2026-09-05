const journal = document.querySelector("#journal");
const popup = document.querySelector("#graft-ui-preview");
const popupHost = document.querySelector(".actual-popup-host");
const detail = document.querySelector("#graft-detail-preview");
const dialog = document.querySelector("#graft-preview-dialog");
const hideElement = document.querySelector("#hide-demo-element");
const status = document.querySelector("#demo-status");
const demoDomain = "journal.example";
let demoState = { sync: {}, local: {}, session: {} };
const media = matchMedia("(prefers-color-scheme: dark)");

function post(frame, message) {
  frame.contentWindow?.postMessage(message, location.origin);
}
function blocked(key) {
  const domains = demoState.sync[key];
  return (
    Array.isArray(domains) &&
    domains.some(
      (domain) => demoDomain === domain || demoDomain.endsWith("." + domain),
    )
  );
}
function renderScene() {
  const settings = demoState.sync;
  const syncDark =
    settings.themeSyncerEnabled !== false &&
    media.matches &&
    !blocked("themeSyncerBlockedDomains");
  const forceDark =
    settings.forceDarkModeEnabled && !blocked("forceDarkModeBlockedDomains");
  journal.classList.toggle("is-dark", Boolean(syncDark || forceDark));
  const hidden =
    demoState.local.elementSelectorRemovedElementsByDomain?.[demoDomain]
      ?.length > 0;
  journal.classList.toggle("is-focused", Boolean(hidden));
  journal.classList.toggle(
    "selector-active",
    Boolean(settings.elementSelectorEnabled),
  );
  hideElement.hidden = !settings.elementSelectorEnabled || hidden;
  const gain =
    settings.soundBoosterEnabled && !blocked("soundBoosterBlockedDomains")
      ? Number(settings.soundBoosterGain ?? 1.5)
      : 1;
  journal.classList.toggle("is-boosted", gain > 1);
  document.querySelector("#volume-output").textContent =
    `${Math.round(gain * 100)}%`;
  journal.style.setProperty("--demo-gain", Math.min(gain, 3));
}
function applyPatch(area, patch, source) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete demoState[area][key];
    else demoState[area][key] = value;
  }
  for (const frame of [popup, detail]) {
    if (frame.contentWindow !== source)
      post(frame, { type: "graft-preview:patch", area, patch });
  }
  renderScene();
}
window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    ![popup.contentWindow, detail.contentWindow].includes(event.source)
  )
    return;
  const message = event.data;
  if (message?.type === "graft-preview:ready") {
    event.source.postMessage(
      { type: "graft-preview:init", state: demoState },
      location.origin,
    );
  } else if (
    message?.type === "graft-preview:change" &&
    ["sync", "local", "session"].includes(message.area) &&
    message.patch &&
    typeof message.patch === "object"
  ) {
    applyPatch(message.area, message.patch, event.source);
    status.textContent = demoState.sync.elementSelectorEnabled
      ? "Selector mode is on. Use “Hide this element” on the sponsored panel."
      : "Demo settings updated. Your actual browser settings stay untouched.";
  } else if (message?.type === "graft-preview:navigate") {
    const view = message.view === "edited-list" ? "edited-list" : "options";
    document.querySelector("#graft-preview-dialog-title").textContent =
      view === "edited-list"
        ? "Graft edited list · Demo"
        : "Graft settings · Demo";
    detail.src = `preview/index.html?view=${view}`;
    if (!dialog.open) dialog.showModal();
  } else if (message?.type === "graft-preview:notice") {
    status.textContent = String(
      message.message || "This action requires the installed extension.",
    );
  }
});
function resizePopup() {
  const scale = Math.min(1, popupHost.clientWidth / 300);
  popup.style.transform = `translateX(-50%) scale(${scale})`;
  popupHost.style.height = `${600 * scale}px`;
}
new ResizeObserver(resizePopup).observe(popupHost);
resizePopup();
media.addEventListener("change", renderScene);
renderScene();
hideElement.addEventListener("click", () => {
  applyPatch("local", {
    elementSelectorRemovedElementsByDomain: {
      [demoDomain]: [
        {
          primarySelector: "#clutter",
          selectorPath: "#clutter",
          tagName: "aside",
          id: "clutter",
          classes: ["clutter"],
          textSnippet: "Sponsored panel",
          removedAt: new Date().toISOString(),
          sourceUrl: "https://journal.example/a-little-room-to-breathe",
        },
      ],
    },
  });
  status.textContent =
    "Element hidden. It stays hidden when selector mode is off. Restore it from the edited list.";
});
document.querySelector("#reset-demo").addEventListener("click", () => {
  demoState = { sync: {}, local: {}, session: {} };
  if (dialog.open) dialog.close();
  popup.src = "preview/index.html";
  detail.removeAttribute("src");
  renderScene();
  status.textContent =
    "Preview reset. Explore Appearance, Media, or Page tools.";
});
document
  .querySelector("#close-preview-dialog")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("close", () => {
  popup.src = "preview/index.html";
});

const wave = document.querySelector(".wave");
for (let i = 0; i < 28; i++) {
  const bar = document.createElement("i");
  bar.style.setProperty(
    "--bar-height",
    `${7 + Math.round((Math.sin(i * 1.7) + 1) * 9)}px`,
  );
  wave.append(bar);
}
document.querySelector("#copy-code").addEventListener("click", async () => {
  const text = document.querySelector("#install-code").textContent;
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Commands copied.";
    document.querySelector("#copy-code").textContent = "Copied ✓";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#install-code"));
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent =
      "Commands selected. Press Command+C or Ctrl+C to copy.";
  }
});
