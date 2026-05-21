(function () {
  "use strict";

  const host = (location.hostname || "").toLowerCase();
  const protocol = (location.protocol || "").toLowerCase();

  if (
    protocol === "chrome:" ||
    protocol === "chrome-extension:" ||
    protocol === "moz-extension:" ||
    protocol === "edge:" ||
    protocol === "about:" ||
    protocol === "file:" ||
    host === "chrome.google.com" ||
    host === "chromewebstore.google.com" ||
    host.endsWith(".chrome.google.com")
  ) {
    throw new Error("graft:skip-host");
  }
})();
