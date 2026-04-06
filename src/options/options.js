const DEFAULT_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true
};

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, isError) {
  const status = $("#status");
  status.textContent = message;
  status.style.color = isError ? "#fca5a5" : "#93c5fd";
}

function applyState() {
  const globalEnabled = $("#themeSyncerEnabled").checked;

  $("#themeSyncerYoutubeEnabled").disabled = !globalEnabled;
  if (!globalEnabled) {
    $("#themeSyncerYoutubeEnabled").checked = false;
  }
}

function persist() {
  const next = {
    themeSyncerEnabled: $("#themeSyncerEnabled").checked,
    themeSyncerYoutubeEnabled:
      $("#themeSyncerYoutubeEnabled").checked && $("#themeSyncerEnabled").checked
  };

  chrome.storage.sync.set(next, () => {
    if (chrome.runtime.lastError) {
      setStatus("Failed to save settings.", true);
      return;
    }
    setStatus("Settings saved.");
    applyState();
    window.setTimeout(() => setStatus(""), 1200);
  });
}

function hydrate() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const settings = { ...DEFAULT_SETTINGS, ...stored };

    $("#themeSyncerEnabled").checked = settings.themeSyncerEnabled;
    $("#themeSyncerYoutubeEnabled").checked = settings.themeSyncerYoutubeEnabled;

    applyState();
    setStatus("Settings loaded.");
    window.setTimeout(() => setStatus(""), 1000);
  });
}

$("#themeSyncerEnabled").addEventListener("change", persist);
$("#themeSyncerYoutubeEnabled").addEventListener("change", persist);

hydrate();
