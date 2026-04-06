const DEFAULT_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, isError) {
  const el = $("status");
  el.textContent = message;
  el.style.color = isError ? "#fca5a5" : "#7dd3fc";
}

function applyState() {
  const master = $("themeSyncerEnabled").checked;
  $("themeSyncerYoutubeEnabled").disabled = !master;
  if (!master) {
    $("themeSyncerYoutubeEnabled").checked = false;
  }
}

function persist() {
  const next = {
    themeSyncerEnabled: $("themeSyncerEnabled").checked,
    themeSyncerYoutubeEnabled:
      $("themeSyncerYoutubeEnabled").checked && $("themeSyncerEnabled").checked
  };

  chrome.storage.sync.set(next, () => {
    if (chrome.runtime.lastError) {
      setStatus("Could not save.", true);
      return;
    }
    setStatus("Saved.");
    applyState();
    window.setTimeout(() => setStatus(""), 900);
  });
}

function hydrate() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const settings = { ...DEFAULT_SETTINGS, ...stored };

    $("themeSyncerEnabled").checked = settings.themeSyncerEnabled;
    $("themeSyncerYoutubeEnabled").checked = settings.themeSyncerYoutubeEnabled;

    applyState();
  });
}

$("themeSyncerEnabled").addEventListener("change", persist);
$("themeSyncerYoutubeEnabled").addEventListener("change", persist);

$("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

hydrate();
