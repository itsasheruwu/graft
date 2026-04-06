const DEFAULT_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const normalized = { ...DEFAULT_SETTINGS, ...stored };
    chrome.storage.sync.set(normalized);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const normalized = { ...DEFAULT_SETTINGS, ...stored };
    chrome.storage.sync.set(normalized);
  });
});
