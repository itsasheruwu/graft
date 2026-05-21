(() => {
  const SETTINGS_DEFAULTS = {
    youtubeAutoTranslateEnabled: true,
    youtubeAutoTranslateTitlesEnabled: true,
    youtubeAutoTranslateDescriptionsEnabled: true,
    youtubeAutoTranslateDebugEnabled: false,
    youtubeAutoTranslateTargetMode: "auto",
    youtubeAutoTranslateTargetLanguage: "en"
  };

  const CACHE_KEY = "youtubeAutoTranslateCache";
  const CACHE_LIMIT = 600;
  const MIN_DETECTION_LENGTH = 8;
  const MIN_CONFIDENCE = 0.72;
  const SKIP_REASON_LABELS = {
    short_text: "Not translated: text is too short to detect safely.",
    non_linguistic: "Not translated: text looks like symbols, numbers, or code.",
    low_confidence: "Not translated: language detection was low confidence.",
    same_language: "Not translated: text already matches your language.",
    mixed_language: "Not translated: text appears mixed-language or code-mixed.",
    translation_failed: "Not translated: translation failed.",
    stale_result: "Not translated: page content changed before translation finished."
  };
  const COMMON_LATIN_WORDS = new Set([
    "a",
    "about",
    "after",
    "all",
    "and",
    "are",
    "as",
    "at",
    "be",
    "best",
    "by",
    "can",
    "day",
    "do",
    "for",
    "from",
    "full",
    "get",
    "how",
    "in",
    "into",
    "is",
    "it",
    "live",
    "make",
    "me",
    "my",
    "new",
    "no",
    "not",
    "of",
    "on",
    "one",
    "or",
    "our",
    "out",
    "part",
    "review",
    "the",
    "this",
    "to",
    "trailer",
    "video",
    "vs",
    "we",
    "with",
    "you",
    "your"
  ]);
  const TARGET_SELECTORS = [
    {
      kind: "title",
      selector: [
        "ytd-watch-metadata h1 yt-formatted-string",
        "h1.ytd-watch-metadata",
        "a#video-title",
        "yt-formatted-string#video-title",
        "#video-title",
        "ytm-watch-metadata h2.slim-video-metadata-title",
        "ytm-watch-metadata .slim-video-metadata-title",
        "ytm-video-with-context-renderer .media-item-headline",
        "ytm-compact-video-renderer .compact-media-item-headline",
        "ytmusic-player-bar .title",
        "ytmusic-player-page h1.title",
        "ytmusic-detail-header-renderer .title",
        "ytmusic-responsive-header-renderer .title",
        "ytmusic-data-bound-header-renderer .title",
        "ytmusic-responsive-list-item-renderer .title",
        "ytmusic-two-row-item-renderer .title"
      ].join(", ")
    },
    {
      kind: "description",
      selector: [
        "ytd-watch-metadata ytd-text-inline-expander #attributed-snippet-text",
        "ytd-watch-metadata ytd-text-inline-expander yt-attributed-string",
        "ytd-watch-metadata #description-inline-expander yt-attributed-string",
        "ytd-expandable-video-description-body-renderer yt-attributed-string",
        "ytd-video-secondary-info-renderer #description yt-formatted-string",
        "#description-inline-expander #attributed-snippet-text",
        "#attributed-snippet-text",
        "ytm-expandable-video-description-body-renderer .description",
        "ytm-expandable-video-description-body-renderer yt-formatted-string",
        "ytm-watch-metadata ytm-expandable-video-description-body-renderer",
        "ytmusic-description-shelf-renderer .description",
        "ytmusic-description-shelf-renderer yt-formatted-string",
        "ytmusic-detail-header-renderer .description",
        "ytmusic-responsive-header-renderer .description",
        "ytmusic-data-bound-header-renderer .description"
      ].join(", ")
    }
  ];

  let targetLanguage = resolveTargetLanguage(SETTINGS_DEFAULTS);
  const GOOGLE_FALLBACK_TIMEOUT_MS = 8000;

  let settings = { ...SETTINGS_DEFAULTS };
  let cache = {};
  let detectorPromise = null;
  const translatorPromises = new Map();
  const pendingTexts = new Set();
  let scanTimer = 0;
  const liveStatus = {
    disabled: false,
    scannedCount: 0,
    latestAction: "idle",
    latestReason: "Waiting for a scan.",
    latestKind: "",
    url: location.href,
    updatedAt: Date.now()
  };

  init();

  async function init() {
    if (!isYouTubeHost(location.hostname)) {
      return;
    }

    settings = await storageSyncGet(SETTINGS_DEFAULTS);
    cache = await storageLocalGet(CACHE_KEY, {});
    markPageStatus("booted");
    targetLanguage = resolveTargetLanguage(settings);
    debugLog("booted", {
      targetLanguage,
      translator: "Translator" in self,
      languageDetector: "LanguageDetector" in self
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }
      let changed = false;
      for (const key of Object.keys(SETTINGS_DEFAULTS)) {
        if (changes[key]) {
          settings[key] = changes[key].newValue;
          changed = true;
        }
      }
      if (changed) {
        targetLanguage = resolveTargetLanguage(settings);
        debugLog("settings-changed", settings);
        scheduleScan();
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "youtube-auto-translate:get-status") {
        return false;
      }

      sendResponse({
        ok: true,
        status: getLiveStatus()
      });
      return false;
    });

    observePage();
    scheduleScan();
  }

  function observePage() {
    const observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window.addEventListener("yt-navigate-finish", scheduleScan, {
      passive: true
    });
    window.addEventListener("popstate", scheduleScan, { passive: true });
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scanPage, 250);
  }

  function scanPage() {
    if (!settings.youtubeAutoTranslateEnabled) {
      markPageStatus("disabled");
      updateLiveStatus({
        disabled: true,
        scannedCount: 0,
        latestAction: "disabled",
        latestReason: "YouTube Auto Translation is disabled.",
        latestKind: ""
      });
      return;
    }

    let candidateCount = 0;
    for (const target of TARGET_SELECTORS) {
      if (target.kind === "title" && !settings.youtubeAutoTranslateTitlesEnabled) {
        continue;
      }
      if (
        target.kind === "description" &&
        !settings.youtubeAutoTranslateDescriptionsEnabled
      ) {
        continue;
      }
      for (const element of document.querySelectorAll(target.selector)) {
        if (hasNestedTargetCandidate(element, target.selector)) {
          continue;
        }
        candidateCount += 1;
        queueElementTranslation(element, target.kind);
      }
    }
    markPageStatus(`scanned:${candidateCount}`);
    const nextStatus = {
      disabled: false,
      scannedCount: candidateCount,
    };
    if (
      candidateCount === 0 ||
      liveStatus.latestAction === "idle" ||
      liveStatus.latestAction === "scanned"
    ) {
      Object.assign(nextStatus, {
        latestAction: candidateCount > 0 ? "scanned" : "skipped",
        latestReason:
          candidateCount > 0
            ? "Scanned the active YouTube page."
            : "No supported title or description nodes found.",
        latestKind: ""
      });
    }
    updateLiveStatus(nextStatus);
    debugLog("scan-complete", { candidateCount, url: location.href });
  }

  function queueElementTranslation(element, kind) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const original = getOriginalText(element);
    const preflightSkipReason = getPreflightSkipReason(original);
    if (preflightSkipReason) {
      markElementStatus(element, "skipped-text");
      applySkipDiagnostic(element, kind, preflightSkipReason);
      updateLiveStatus({
        latestAction: "skipped",
        latestReason: SKIP_REASON_LABELS[preflightSkipReason],
        latestKind: kind
      });
      return;
    }

    if (kind === "description" && element.dataset.btTranslateStatus === "done") {
      ensureDescriptionTranslationBlock(element);
      return;
    }

    if (
      element.dataset.btTranslateOriginal === original &&
      element.dataset.btTranslateStatus === "done"
    ) {
      const translated = element.dataset.btTranslateText || "";
      if (translated && normalizeTranslatedText(element.textContent) !== translated) {
        applyTranslation(
          element,
          original,
          translated,
          element.dataset.btTranslateSourceLanguage || "auto"
        );
      }
      return;
    }

    const requestKey = `${kind}:${original}`;
    if (pendingTexts.has(requestKey)) {
      return;
    }

    pendingTexts.add(requestKey);
    element.dataset.btTranslateOriginal = original;
    element.dataset.btTranslateStatus = "pending";
    markElementStatus(element, "pending");
    debugLog("translate-start", { kind, original });

    translateText(original)
      .then((result) => {
        if (!result || element.dataset.btTranslateOriginal !== original) {
          markElementStatus(element, "skipped-result");
          applySkipDiagnostic(element, kind, result?.skippedReason || "stale_result");
          updateLiveStatus({
            latestAction: "skipped",
            latestReason: SKIP_REASON_LABELS[result?.skippedReason || "stale_result"],
            latestKind: kind
          });
          debugLog("translate-skipped", { kind, original });
          return;
        }
        if (result.skippedReason) {
          element.dataset.btTranslateStatus = "skipped";
          applySkipDiagnostic(element, kind, result.skippedReason);
          updateLiveStatus({
            latestAction: "skipped",
            latestReason: SKIP_REASON_LABELS[result.skippedReason],
            latestKind: kind
          });
          debugLog("translate-skipped", {
            kind,
            original,
            reason: result.skippedReason
          });
          return;
        }
        applyTranslation(element, original, result.text, result.sourceLanguage, kind);
        updateLiveStatus({
          latestAction: "applied",
          latestReason: `Translated ${kind} from ${result.sourceLanguage || "auto"}.`,
          latestKind: kind
        });
        debugLog("translate-applied", {
          kind,
          sourceLanguage: result.sourceLanguage,
          original,
          translated: result.text
        });
      })
      .catch(() => {
        element.dataset.btTranslateStatus = "skipped";
        markElementStatus(element, "error");
        applySkipDiagnostic(element, kind, "translation_failed");
        updateLiveStatus({
          latestAction: "skipped",
          latestReason: SKIP_REASON_LABELS.translation_failed,
          latestKind: kind
        });
        debugLog("translate-error", { kind, original });
      })
      .finally(() => {
        pendingTexts.delete(requestKey);
      });
  }

  function hasNestedTargetCandidate(element, selector) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    return Array.from(element.querySelectorAll(selector)).some(
      (candidate) => candidate instanceof HTMLElement
    );
  }

  function getOriginalText(element) {
    return (
      element.dataset.btTranslateOriginal ||
      element.textContent ||
      element.getAttribute("aria-label") ||
      ""
    ).replace(/[ \t\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function getPreflightSkipReason(text) {
    if (!text || text.length < MIN_DETECTION_LENGTH) {
      return "short_text";
    }
    if (/^[\d\s.,:;!?'"()[\]{}|/@#&%+\-=–—_$]+$/.test(text)) {
      return "non_linguistic";
    }
    if (looksMixedLanguage(text)) {
      return "mixed_language";
    }
    return "";
  }

  async function translateText(text) {
    const cacheKey = `${targetLanguage}:${text}`;
    if (cache[cacheKey]) {
      return cache[cacheKey];
    }

    const detected = (await detectLanguage(text)) || {};
    const sourceLanguage = detected.language || detectLanguageByScript(text);
    if (detected.skippedReason && !sourceLanguage) {
      return { skippedReason: detected.skippedReason };
    }
    if (!sourceLanguage) {
      return { skippedReason: "low_confidence" };
    }
    if (sameBaseLanguage(sourceLanguage, targetLanguage)) {
      return { skippedReason: "same_language", sourceLanguage };
    }

    const mixedLanguageSkip = getMixedLanguageSkipReason(text, sourceLanguage);
    if (mixedLanguageSkip) {
      debugLog("mixed-language-skip", {
        reason: mixedLanguageSkip.reason,
        sourceLanguage,
        targetLanguage: targetLanguage,
        stats: mixedLanguageSkip.stats
      });
      return null;
    }

    let translated = "";
    const translator = await getTranslator(sourceLanguage, targetLanguage);
    if (translator) {
      translated = normalizeTranslatedText(await translator.translate(text));
    }

    if (!translated || translated === text) {
      const fallback =
        (await translateWithBackground(text, sourceLanguage)) ||
        (await translateWithFetch(text, sourceLanguage, targetLanguage));
      if (!fallback) {
        debugLog("translate-fallback-empty", { sourceLanguage, targetLanguage: targetLanguage });
        return { skippedReason: "translation_failed", sourceLanguage };
      }
      translated = fallback.text;
    }

    if (!translated || translated === text) {
      return { skippedReason: "translation_failed", sourceLanguage };
    }

    const result = { text: translated, sourceLanguage };
    cache[cacheKey] = result;
    trimCache();
    chrome.storage.local.set({ [CACHE_KEY]: cache });
    return result;
  }

  async function detectLanguage(text) {
    if (!("LanguageDetector" in self)) {
      debugLog("detector-unavailable", {});
      return null;
    }

    const detector = await getDetector();
    if (!detector) {
      debugLog("detector-create-failed", {});
      return { skippedReason: "low_confidence" };
    }

    const results = await detector.detect(text);
    const best = results?.[0];
    if (!best || best.confidence < MIN_CONFIDENCE) {
      debugLog("detector-low-confidence", { best });
      return null;
    }

    return { language: normalizeLanguage(best.detectedLanguage), confidence: best.confidence };
  }

  async function getDetector() {
    if (detectorPromise) {
      return detectorPromise;
    }

    detectorPromise = (async () => {
      const availability = await self.LanguageDetector.availability();
      if (availability === "unavailable") {
        return null;
      }
      return self.LanguageDetector.create();
    })().catch(() => null);

    return detectorPromise;
  }

  async function getTranslator(sourceLanguage, targetLanguage) {
    if (!("Translator" in self)) {
      debugLog("translator-unavailable", {});
      return null;
    }

    const key = `${sourceLanguage}:${targetLanguage}`;
    if (translatorPromises.has(key)) {
      return translatorPromises.get(key);
    }

    const promise = (async () => {
      const availability = await self.Translator.availability({
        sourceLanguage,
        targetLanguage
      });
      if (availability === "unavailable") {
        debugLog("translator-pair-unavailable", { sourceLanguage, targetLanguage });
        return null;
      }
      debugLog("translator-create", {
        sourceLanguage,
        targetLanguage,
        availability
      });
      return self.Translator.create({ sourceLanguage, targetLanguage });
    })().catch(() => null);

    translatorPromises.set(key, promise);
    return promise;
  }

  async function translateWithBackground(text, sourceLanguage) {
    const timeout = new Promise((resolve) => {
      window.setTimeout(() => resolve(null), GOOGLE_FALLBACK_TIMEOUT_MS);
    });

    const request = new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "youtube-auto-translate:translate",
          text,
          sourceLanguage,
          targetLanguage: targetLanguage
        },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            debugLog("background-fallback-failed", {
              error: chrome.runtime.lastError?.message || response?.error || "No response"
            });
            resolve(null);
            return;
          }
          resolve({
            text: normalizeTranslatedText(response.text),
            sourceLanguage: normalizeLanguage(
              response.sourceLanguage || sourceLanguage
            )
          });
        }
      );
    });

    return Promise.race([request, timeout]);
  }

  async function translateWithFetch(text, sourceLanguage, targetLanguage) {
    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", normalizeGoogleLanguage(sourceLanguage));
      url.searchParams.set("tl", normalizeGoogleLanguage(targetLanguage));
      url.searchParams.append("dt", "t");
      url.searchParams.set("q", text);

      const response = await fetch(url.toString());
      if (!response.ok) {
        debugLog("direct-fallback-failed", { status: response.status });
        return null;
      }

      const data = await response.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part) => part?.[0] || "").join("")
        : "";
      const normalized = normalizeTranslatedText(translated);
      if (!normalized) {
        return null;
      }
      return {
        text: normalized,
        sourceLanguage: normalizeLanguage(data?.[2] || sourceLanguage)
      };
    } catch (error) {
      debugLog("direct-fallback-error", {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  function applyTranslation(element, original, translated, sourceLanguage, kind) {
    clearSkipDiagnostic(element);
    if (kind === "description") {
      applyDescriptionTranslation(element, original, translated, sourceLanguage);
      return;
    }

    element.textContent = translated;
    element.dataset.btTranslateStatus = "done";
    element.dataset.btTranslateText = translated;
    element.dataset.btTranslateSourceLanguage = sourceLanguage;
    element.title = `Original (${sourceLanguage}): ${original}`;
    element.setAttribute("title", `Original (${sourceLanguage}): ${original}`);
    markElementStatus(element, "done");
  }

  function applyDescriptionTranslation(element, original, translated, sourceLanguage) {
    element.dataset.btTranslateStatus = "done";
    element.dataset.btTranslateOriginal = original;
    element.dataset.btTranslateText = translated;
    element.dataset.btTranslateSourceLanguage = sourceLanguage;
    ensureDescriptionTranslationBlock(element);
  }

  function ensureDescriptionTranslationBlock(element) {
    const translated = element.dataset.btTranslateText || "";
    const sourceLanguage = element.dataset.btTranslateSourceLanguage || "auto";
    if (!translated) {
      return;
    }

    const host = element.closest("ytd-text-inline-expander") || element.parentElement;
    if (!host) {
      return;
    }

    let block = host.querySelector(":scope > .bt-youtube-translation");
    if (!block) {
      block = document.createElement("div");
      block.className = "bt-youtube-translation";
      block.style.whiteSpace = "pre-wrap";
      block.style.marginBottom = "12px";
      block.style.paddingBottom = "12px";
      block.style.borderBottom = "1px solid rgba(255,255,255,0.14)";
      block.style.font = "inherit";
      block.style.color = "inherit";
      block.style.lineHeight = "inherit";
      host.insertBefore(block, host.firstChild);
    }

    block.textContent = translated;
    block.setAttribute("title", `Translated from ${sourceLanguage}`);
  }

  function applySkipDiagnostic(element, kind, reason) {
    const label = SKIP_REASON_LABELS[reason] || SKIP_REASON_LABELS.translation_failed;
    element.dataset.btTranslateSkipReason = reason;
    element.dataset.btTranslateSkipDiagnostic = label;

    if (kind === "title") {
      const existingTitle = element.getAttribute("title") || "";
      if (!existingTitle || existingTitle.startsWith("Not translated:")) {
        element.setAttribute("title", label);
      }
      return;
    }

    ensureDescriptionSkipNote(element, label);
  }

  function clearSkipDiagnostic(element) {
    delete element.dataset.btTranslateSkipReason;
    delete element.dataset.btTranslateSkipDiagnostic;
    const host = element.closest("ytd-text-inline-expander") || element.parentElement;
    host?.querySelector(":scope > .bt-youtube-translation-skip")?.remove();
  }

  function ensureDescriptionSkipNote(element, label) {
    const host = element.closest("ytd-text-inline-expander") || element.parentElement;
    if (!host) {
      return;
    }

    let note = host.querySelector(":scope > .bt-youtube-translation-skip");
    if (!note) {
      note = document.createElement("div");
      note.className = "bt-youtube-translation-skip";
      note.style.margin = "0 0 8px";
      note.style.font = "12px/1.35 inherit";
      note.style.opacity = "0.58";
      note.style.color = "inherit";
      host.insertBefore(note, host.firstChild);
    }
    note.textContent = label;
  }

  function markPageStatus(status) {
    document.documentElement.dataset.btYoutubeAutoTranslate = status;
  }

  function markElementStatus(element, status) {
    element.dataset.btTranslateStatus = status;
  }

  function updateLiveStatus(patch) {
    Object.assign(liveStatus, patch, {
      url: location.href,
      updatedAt: Date.now()
    });
  }

  function getLiveStatus() {
    return {
      disabled: Boolean(liveStatus.disabled || !settings.youtubeAutoTranslateEnabled),
      scannedCount: liveStatus.scannedCount,
      latestAction: liveStatus.latestAction,
      latestReason: liveStatus.latestReason,
      latestKind: liveStatus.latestKind,
      url: liveStatus.url,
      updatedAt: liveStatus.updatedAt
    };
  }

  function debugLog(event, detail) {
    if (!settings.youtubeAutoTranslateDebugEnabled) {
      return;
    }

    const payload = {
      type: "youtube-auto-translate:log",
      event,
      detail,
      url: location.href
    };

    console.log("[Graft][YouTube Auto Translation]", event, detail);
    try {
      chrome.runtime.sendMessage(payload);
    } catch {
      // Console logging is enough when the service worker is unavailable.
    }
  }

  function normalizeTranslatedText(text) {
    return String(text || "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function resolveTargetLanguage(nextSettings) {
    const mode = String(nextSettings?.youtubeAutoTranslateTargetMode || "auto");
    if (mode === "fixed") {
      return normalizeLanguage(nextSettings?.youtubeAutoTranslateTargetLanguage || "en");
    }

    return normalizeLanguage(
      chrome.i18n?.getUILanguage?.() || navigator.language || "en"
    );
  }

  function normalizeLanguage(language) {
    const normalized = String(language || "en").replace("_", "-").trim();
    if (normalized.toLowerCase() === "zh-hant") {
      return "zh-Hant";
    }
    if (normalized.toLowerCase() === "zh-hans") {
      return "zh";
    }
    return normalized.split("-")[0].toLowerCase();
  }

  function normalizeGoogleLanguage(language) {
    const normalized = String(language || "en").replace("_", "-").trim();
    if (normalized.toLowerCase() === "zh-hant") {
      return "zh-TW";
    }
    if (normalized.toLowerCase() === "zh-hans") {
      return "zh-CN";
    }
    return normalized.split("-")[0].toLowerCase();
  }

  function sameBaseLanguage(left, right) {
    return left.split("-")[0].toLowerCase() === right.split("-")[0].toLowerCase();
  }

  function looksMixedLanguage(text) {
    const trimmed = text.trim();
    if (trimmed.length < MIN_DETECTION_LENGTH * 2) {
      return false;
    }

    const scriptHits = [
      /[A-Za-z]/.test(trimmed),
      /[\u3040-\u30ff]/.test(trimmed),
      /[\uac00-\ud7af]/.test(trimmed),
      /[\u4e00-\u9fff]/.test(trimmed),
      /[\u0400-\u04ff]/.test(trimmed),
      /[\u0600-\u06ff]/.test(trimmed),
      /[\u0900-\u097f]/.test(trimmed),
      /[\u0e00-\u0e7f]/.test(trimmed)
    ].filter(Boolean).length;

    if (scriptHits >= 2) {
      return true;
    }

    const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
    const codeLikeTokens = trimmed.match(/(?:https?:\/\/|www\.|[@#][\w-]+|[\w-]+[._/][\w./-]+|[{}[\]<>`=]|[A-Za-z]+[A-Z][a-z])/g) || [];
    return tokenCount >= 6 && codeLikeTokens.length / tokenCount > 0.28;
  }

  function detectLanguageByScript(text) {
    if (/[\u3040-\u30ff]/.test(text)) {
      return "ja";
    }
    if (/[\uac00-\ud7af]/.test(text)) {
      return "ko";
    }
    if (/[\u4e00-\u9fff]/.test(text)) {
      return "zh";
    }
    if (/[\u0400-\u04ff]/.test(text)) {
      return "ru";
    }
    if (/[\u0600-\u06ff]/.test(text)) {
      return "ar";
    }
    if (/[\u0900-\u097f]/.test(text)) {
      return "hi";
    }
    if (/[\u0e00-\u0e7f]/.test(text)) {
      return "th";
    }
    return null;
  }

  function getMixedLanguageSkipReason(text, sourceLanguage) {
    const stats = getTextMixStats(text);
    if (!stats.dominantNonLatinScript) {
      return null;
    }
    if (stats.nonLatinLetters < 4 || stats.latinLetters < 10) {
      return null;
    }
    if (!hasMeaningfulLatinContent(stats)) {
      return null;
    }

    const scriptLanguage = detectLanguageByScript(text);
    if (
      scriptLanguage &&
      sourceLanguage &&
      !sameBaseLanguage(scriptLanguage, sourceLanguage) &&
      stats.nonLatinLetters < 12
    ) {
      return null;
    }

    return {
      reason: "meaningful-latin-content-with-non-latin-script",
      stats
    };
  }

  function getTextMixStats(text) {
    const stats = {
      latinLetters: 0,
      nonLatinLetters: 0,
      dominantNonLatinScript: "",
      commonLatinWords: 0,
      latinWordCount: 0,
      longLatinWordCount: 0
    };
    const scriptCounts = {
      cjk: countMatches(text, /[\u3040-\u30ff\u3400-\u9fff]/g),
      hangul: countMatches(text, /[\uac00-\ud7af]/g),
      cyrillic: countMatches(text, /[\u0400-\u04ff]/g),
      arabic: countMatches(text, /[\u0600-\u06ff]/g),
      devanagari: countMatches(text, /[\u0900-\u097f]/g),
      thai: countMatches(text, /[\u0e00-\u0e7f]/g)
    };

    for (const [script, count] of Object.entries(scriptCounts)) {
      stats.nonLatinLetters += count;
      if (!stats.dominantNonLatinScript || count > scriptCounts[stats.dominantNonLatinScript]) {
        stats.dominantNonLatinScript = script;
      }
    }
    if (!scriptCounts[stats.dominantNonLatinScript]) {
      stats.dominantNonLatinScript = "";
    }

    const latinWords = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
    for (const word of latinWords) {
      const compact = word.replace(/['’-]/g, "");
      if (isIgnorableLatinToken(compact)) {
        continue;
      }

      const lower = compact.toLowerCase();
      stats.latinWordCount += 1;
      stats.latinLetters += compact.length;
      if (compact.length >= 4) {
        stats.longLatinWordCount += 1;
      }
      if (COMMON_LATIN_WORDS.has(lower)) {
        stats.commonLatinWords += 1;
      }
    }

    return stats;
  }

  function hasMeaningfulLatinContent(stats) {
    if (stats.commonLatinWords >= 2 && stats.latinLetters >= 10) {
      return true;
    }
    if (stats.commonLatinWords >= 1 && stats.longLatinWordCount >= 2 && stats.latinLetters >= 14) {
      return true;
    }
    return stats.latinWordCount >= 3 && stats.longLatinWordCount >= 2 && stats.latinLetters >= 18;
  }

  function isIgnorableLatinToken(token) {
    return (
      !token ||
      token.length < 3 ||
      (/^[A-Z0-9]+$/.test(token) && token.length <= 6) ||
      /^(official|mv|ost|ep|op|pt|vol|feat|ft)$/i.test(token)
    );
  }

  function countMatches(text, pattern) {
    return (text.match(pattern) || []).length;
  }

  function isYouTubeHost(hostname) {
    return (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname.endsWith(".youtube.com")
    );
  }

  function trimCache() {
    const entries = Object.entries(cache);
    if (entries.length <= CACHE_LIMIT) {
      return;
    }
    cache = Object.fromEntries(entries.slice(entries.length - CACHE_LIMIT));
  }

  function storageSyncGet(defaults) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(defaults, (stored) => {
        if (chrome.runtime.lastError) {
          resolve(defaults);
          return;
        }
        resolve({ ...defaults, ...stored });
      });
    });
  }

  function storageLocalGet(key, fallback) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: fallback }, (stored) => {
        if (chrome.runtime.lastError) {
          resolve(fallback);
          return;
        }
        resolve(stored[key] || fallback);
      });
    });
  }
})();
