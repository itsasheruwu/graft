(function () {
  "use strict";

  const BUTTON_ID = "graft-scroll-to-top-button";
  const DEFAULT_SETTINGS = {
    scrollToTopEnabled: false,
    scrollToTopBlockedDomains: [],
  };
  const SHOW_THRESHOLD_PX = 300;

  let settings = { ...DEFAULT_SETTINGS };
  let button = null;
  let isVisible = false;
  let scrollListener = null;

  function normalizeDomainKey(value) {
    return String(value || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }

  function normalizeDomainList(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => normalizeDomainKey(entry)).filter(Boolean);
  }

  function isBlocked() {
    const host = normalizeDomainKey(location.hostname);
    if (!host) {
      return false;
    }

    return normalizeDomainList(settings.scrollToTopBlockedDomains).some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  }

  function shouldSkipFrame() {
    try {
      return (
        window.self !== window.top ||
        !document.documentElement ||
        document.documentElement.hasAttribute("data-graft-ui")
      );
    } catch (_error) {
      return true;
    }
  }

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function createButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      return existing;
    }

    const node = document.createElement("button");
    node.id = BUTTON_ID;
    node.type = "button";
    node.setAttribute("aria-label", "Scroll to top");
    node.setAttribute("title", "Scroll to top");
    node.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6"/>
      </svg>
    `;

    Object.assign(node.style, {
      position: "fixed",
      zIndex: "2147483646",
      bottom: "24px",
      right: "24px",
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      border: "1px solid rgba(154, 223, 143, 0.35)",
      backgroundColor: "rgba(15, 17, 21, 0.9)",
      color: "#9adf8f",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 6px 24px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(154, 223, 143, 0.1)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      opacity: "0",
      visibility: "hidden",
      transform: "translateY(12px)",
      transition: "opacity 180ms ease, transform 180ms ease, visibility 180ms ease",
      pointerEvents: "none",
    });

    node.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    node.addEventListener("mouseenter", () => {
      node.style.backgroundColor = "rgba(25, 29, 37, 0.95)";
      node.style.boxShadow = "0 8px 28px rgba(0, 0, 0, 0.32), 0 0 12px rgba(154, 223, 143, 0.25)";
    });

    node.addEventListener("mouseleave", () => {
      node.style.backgroundColor = "rgba(15, 17, 21, 0.9)";
      node.style.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(154, 223, 143, 0.1)";
    });

    document.body.appendChild(node);
    return node;
  }

  function ensureButton() {
    if (button) {
      return button;
    }

    if (!document.body) {
      return null;
    }

    button = createButton();
    return button;
  }

  function removeButton() {
    button?.remove();
    button = null;
    isVisible = false;
  }

  function updateVisibility() {
    const node = ensureButton();
    if (!node) {
      return;
    }

    const scrolledEnough = getScrollTop() > SHOW_THRESHOLD_PX;
    if (scrolledEnough === isVisible) {
      return;
    }

    isVisible = scrolledEnough;
    if (scrolledEnough) {
      node.style.opacity = "1";
      node.style.visibility = "visible";
      node.style.transform = "translateY(0)";
      node.style.pointerEvents = "auto";
    } else {
      node.style.opacity = "0";
      node.style.visibility = "hidden";
      node.style.transform = "translateY(12px)";
      node.style.pointerEvents = "none";
    }
  }

  function apply() {
    if (shouldSkipFrame()) {
      removeButton();
      return;
    }

    if (!settings.scrollToTopEnabled || isBlocked()) {
      removeButton();
      return;
    }

    ensureButton();
    updateVisibility();

    if (!scrollListener) {
      scrollListener = () => updateVisibility();
      window.addEventListener("scroll", scrollListener, { passive: true });
    }
  }

  function teardown() {
    if (scrollListener) {
      window.removeEventListener("scroll", scrollListener);
      scrollListener = null;
    }
    removeButton();
  }

  function loadAndApply() {
    if (!chrome.storage?.sync) {
      apply();
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        return;
      }
      settings = { ...DEFAULT_SETTINGS, ...stored };
      apply();
    });
  }

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }

      const relevant =
        "scrollToTopEnabled" in changes ||
        "scrollToTopBlockedDomains" in changes;
      if (!relevant) {
        return;
      }

      settings = {
        ...settings,
        ...("scrollToTopEnabled" in changes
          ? { scrollToTopEnabled: Boolean(changes.scrollToTopEnabled.newValue) }
          : {}),
        ...("scrollToTopBlockedDomains" in changes
          ? {
              scrollToTopBlockedDomains: normalizeDomainList(
                changes.scrollToTopBlockedDomains.newValue
              ),
            }
          : {}),
      };

      apply();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAndApply, { once: true });
  } else {
    loadAndApply();
  }

  window.addEventListener("beforeunload", teardown, { once: true });
})();
