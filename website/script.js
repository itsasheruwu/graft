const journal = document.querySelector("#journal");
const popup = document.querySelector("#graft-ui-preview");
const flyout = document.querySelector("#popup-flyout");
const pin = document.querySelector("#graft-pin");
const sound = document.querySelector("#ridge-audio");
const listen = document.querySelector("#listen-ridge");
let audioContext;
let amplifier;
let soundGain = 1;
const detail = document.querySelector("#graft-detail-preview");
const journalTab = document.querySelector("#journal-tab");
const detailTab = document.querySelector("#detail-tab");
const detailTabGroup = document.querySelector("#detail-tab-group");
const address = document.querySelector("#tab-address");
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
  soundGain = gain;
  if (amplifier) amplifier.gain.setTargetAtTime(gain, audioContext.currentTime, 0.025);
  document.querySelector("#volume-output").textContent =
    `${Math.round(gain * 100)}%`;
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
    status.textContent = "";
  } else if (message?.type === "graft-preview:navigate") {
    const view = message.view === "edited-list" ? "edited-list" : "options";
    detail.title = detailTab.textContent = view === "edited-list" ? "Graft edited list" : "Graft settings";
    detail.src = `preview/index.html?view=${view}`;
    detailTabGroup.hidden = false;
    selectDetail(true);
    detailTab.focus({ preventScroll: true });
  } else if (message?.type === "graft-preview:notice") {
    status.textContent = String(
      message.message || "This action requires the installed extension.",
    );
  }
});
function setPopupOpen(open, focusPin = false) {
  flyout.hidden = !open;
  pin.setAttribute("aria-expanded", String(open));
  pin.setAttribute("aria-label", open ? "Close Graft toolbar popup" : "Open Graft toolbar popup");
  if (open) popup.focus();
  else if (focusPin) pin.focus({ preventScroll: true });
}

pin.addEventListener("click", () => setPopupOpen(flyout.hidden, true));
document.addEventListener("pointerdown", (event) => {
  if (!flyout.hidden && !flyout.contains(event.target) && !pin.contains(event.target)) {
    setPopupOpen(false);
  }
});
function dismissOnEscape(event) {
  if (event.key === "Escape" && !event.defaultPrevented && !flyout.hidden) {
    setPopupOpen(false, true);
  }
}
document.addEventListener("keydown", dismissOnEscape);

let popupObserver;
function connectPopup() {
  const doc = popup.contentDocument;
  const root = doc?.getElementById("root");
  if (!root) return;
  doc.addEventListener("keydown", dismissOnEscape);
  popupObserver?.disconnect();
  popupObserver = new ResizeObserver(() => {
    const height = root.offsetHeight;
    if (height > 0) flyout.style.setProperty("--popup-content-height", height + "px");
  });
  popupObserver.observe(root);
}
popup.addEventListener("load", connectPopup);
connectPopup();

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
          classes: ["field-sponsor"],
          textSnippet: "Pocket Field Press",
          removedAt: new Date().toISOString(),
          sourceUrl: "https://journal.example/a-little-room-to-breathe",
        },
      ],
    },
  });
  status.textContent =
    "Sponsor hidden. Restore it from the edited list.";
});
document.querySelector("#reset-demo").addEventListener("click", () => {
  demoState = { sync: {}, local: {}, session: {} };
  setPopupOpen(false);
  sound.pause();
  sound.currentTime = 0;
  closeDetail();
  popup.src = "preview/index.html";
  renderScene();
  status.textContent =
    "Playground reset.";
});
function selectDetail(active) {
  setPopupOpen(false);
  detail.hidden = !active;
  journal.hidden = active;
  pin.disabled = active;
  journalTab.setAttribute("aria-pressed", String(!active));
  detailTab.setAttribute("aria-pressed", String(active));
  address.textContent = active ? detail.title : demoDomain;
  if (!active) {
    const path = document.createElement("span");
    path.className = "location-path";
    path.textContent = "/a-little-room-to-breathe";
    address.append(path);
  }
}
function closeDetail() {
  selectDetail(false);
  detailTabGroup.hidden = true;
  detail.removeAttribute("src");
}
journalTab.addEventListener("click", () => selectDetail(false));
detailTab.addEventListener("click", () => selectDetail(true));
document.querySelector("#close-detail").addEventListener("click", () => {
  closeDetail();
  journalTab.focus({ preventScroll: true });
});

listen.addEventListener("click", async () => {
  if (!sound.paused) {
    sound.pause();
    return;
  }
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      amplifier = audioContext.createGain();
      amplifier.gain.value = soundGain;
      audioContext.createMediaElementSource(sound).connect(amplifier);
      amplifier.connect(audioContext.destination);
    }
    await audioContext.resume();
    await sound.play();
  } catch {
    status.textContent = "The soundscape could not play. Try again.";
  }
});
function updateListenButton() {
  const playing = !sound.paused;
  listen.setAttribute("aria-label", playing ? "Pause ridge soundscape" : "Play ridge soundscape");
  listen.querySelector(".listen-play").hidden = playing;
  listen.querySelector(".listen-pause").hidden = !playing;
}
sound.addEventListener("play", updateListenButton);
sound.addEventListener("pause", updateListenButton);
sound.addEventListener("ended", updateListenButton);

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

const gardenSwitch = document.querySelector(".garden-switch");
const gardenScene = document.querySelector(".garden-scene");

gardenSwitch.addEventListener("click", () => {
  const night = gardenSwitch.getAttribute("aria-pressed") !== "true";
  gardenSwitch.setAttribute("aria-pressed", String(night));
  gardenScene.src = night ? "assets/garden-night.png" : "assets/garden.png";
});

function openLinkedTweak() {
  const target = document.getElementById(location.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
}
window.addEventListener("hashchange", openLinkedTweak);
document.querySelectorAll(".sample-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.getElementById(card.hash.slice(1)).open = true;
  });
});
openLinkedTweak();
