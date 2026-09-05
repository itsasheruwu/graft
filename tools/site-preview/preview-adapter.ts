type Values = Record<string, unknown>;
type State = { sync: Values; local: Values; session: Values };
type Listener = (changes: Values, area: string) => void;
const origin = location.origin;
const listeners = new Set<Listener>();
const state: State = { sync: {}, local: {}, session: {} };
const clone = <T>(value: T): T => structuredClone(value);
const send = (type: string, extra: Values = {}) => {
  if (parent !== window)
    parent.postMessage({ type: `graft-preview:${type}`, ...extra }, origin);
};

function apply(area: keyof State, patch: Values, notifyParent: boolean) {
  const changes: Values = {};
  for (const [key, value] of Object.entries(patch)) {
    if (JSON.stringify(state[area][key]) === JSON.stringify(value)) continue;
    changes[key] = {
      oldValue: clone(state[area][key]),
      newValue: clone(value),
    };
    if (value === undefined) delete state[area][key];
    else state[area][key] = clone(value);
  }
  if (Object.keys(changes).length) {
    listeners.forEach((listener) => listener(clone(changes), area));
    if (notifyParent) send("change", { area, patch: clone(patch) });
  }
}

function storageArea(area: keyof State) {
  return {
    get(
      keys: string | string[] | Values | null,
      callback?: (values: Values) => void,
    ) {
      let result: Values = {};
      if (keys == null) result = clone(state[area]);
      else if (typeof keys === "string")
        result = { [keys]: clone(state[area][keys]) };
      else if (Array.isArray(keys))
        keys.forEach((key) => {
          result[key] = clone(state[area][key]);
        });
      else {
        result = clone(keys);
        Object.keys(keys).forEach((key) => {
          if (key in state[area]) result[key] = clone(state[area][key]);
        });
      }
      if (callback) queueMicrotask(() => callback(result));
      return Promise.resolve(result);
    },
    set(patch: Values, callback?: () => void) {
      apply(area, patch, true);
      if (callback) queueMicrotask(callback);
      return Promise.resolve();
    },
    remove(keys: string | string[], callback?: () => void) {
      const patch = Object.fromEntries(
        (Array.isArray(keys) ? keys : [keys]).map((key) => [key, undefined]),
      );
      apply(area, patch, true);
      if (callback) queueMicrotask(callback);
      return Promise.resolve();
    },
    clear(callback?: () => void) {
      return this.remove(Object.keys(state[area]), callback);
    },
  };
}

export async function installPreviewAdapter() {
  const route = (url: string) => {
    const view = url.includes("edited-list") ? "edited-list" : "options";
    send("navigate", { view });
  };
  const runtime = {
    id: "graft-website-preview",
    lastError: undefined as { message: string } | undefined,
    getURL(path: string) {
      return new URL(
        `./index.html?view=${path.includes("edited-list") ? "edited-list" : "options"}`,
        location.href,
      ).href;
    },
    openOptionsPage(callback?: () => void) {
      route("options");
      callback?.();
      return Promise.resolve();
    },
    sendMessage(_message: Values, callback?: (response: Values) => void) {
      const result = {
        ok: false,
        error:
          "This website preview uses demo data. Live accounts and notifications require the installed extension.",
      };
      callback?.(result);
      return Promise.resolve(result);
    },
  };
  const previewChrome = {
    runtime,
    storage: {
      sync: storageArea("sync"),
      local: storageArea("local"),
      session: storageArea("session"),
      onChanged: {
        addListener(listener: Listener) {
          listeners.add(listener);
        },
        removeListener(listener: Listener) {
          listeners.delete(listener);
        },
        hasListener(listener: Listener) {
          return listeners.has(listener);
        },
      },
    },
    tabs: {
      query(_query: Values, callback?: (tabs: Values[]) => void) {
        const tabs = [
          {
            id: 1,
            active: true,
            currentWindow: true,
            url: "https://journal.example/a-little-room-to-breathe",
            title: "The everyday journal",
          },
        ];
        callback?.(tabs);
        return Promise.resolve(tabs);
      },
      create({ url }: { url: string }, callback?: (tab: Values) => void) {
        if (
          url.includes("view=") ||
          url.includes("options") ||
          url.includes("edited-list")
        )
          route(url);
        else
          send("notice", {
            message: "Page navigation is simulated in this preview.",
          });
        callback?.({ id: 1, url });
        return Promise.resolve({ id: 1, url });
      },
      sendMessage(
        _tab: number,
        _message: Values,
        callback?: (response: Values) => void,
      ) {
        const message =
          "This action runs on real webpages in the installed extension. You can explore its settings here.";
        runtime.lastError = { message };
        try {
          callback?.({ ok: false, error: message });
        } finally {
          runtime.lastError = undefined;
        }
        send("notice", { message });
        return Promise.resolve({ ok: false, error: message });
      },
    },
    permissions: {
      contains(_permissions: Values, callback?: (granted: boolean) => void) {
        callback?.(true);
        return Promise.resolve(true);
      },
      request(_permissions: Values, callback?: (granted: boolean) => void) {
        callback?.(true);
        return Promise.resolve(true);
      },
    },
    notifications: {
      getPermissionLevel(callback: (level: string) => void) {
        callback("granted");
      },
      create() {
        return Promise.resolve("preview-only");
      },
    },
    i18n: {
      getUILanguage() {
        return navigator.language;
      },
    },
  };
  // This object belongs only to the website iframe. It cannot access extension data.
  Object.defineProperty(window, "chrome", { value: previewChrome });

  await new Promise<void>((resolve) => {
    let ready = false;
    const finish = () => {
      if (!ready) {
        ready = true;
        resolve();
      }
    };
    window.addEventListener("message", (event) => {
      if (event.origin !== origin || event.source !== parent) return;
      const message = event.data;
      if (message?.type === "graft-preview:init") {
        for (const area of ["sync", "local", "session"] as const) {
          if (message.state?.[area] && typeof message.state[area] === "object")
            apply(area, message.state[area], false);
        }
        finish();
      } else if (
        message?.type === "graft-preview:patch" &&
        ["sync", "local", "session"].includes(message.area)
      ) {
        apply(message.area, message.patch ?? {}, false);
      }
    });
    send("ready");
    // The same UI can also be opened directly for isolated visual QA.
    setTimeout(finish, 250);
  });
}
