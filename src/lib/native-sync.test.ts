import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function fixture() {
  const source = readFileSync(new URL("../background/service_worker.js", import.meta.url), "utf8")
    .split("async function isRobloxWatcherOwnedByGraftApp")[0];
  const messages: any[] = [];
  const state: Record<string, unknown> = {};
  let listener: (message: any) => void = () => {};
  let disconnect: () => void = () => {};
  let failWrite = false;
  let getActive = 0;
  let maxGets = 0;
  let pendingRead: (() => void) | undefined;
  let delayReads = false;
  let afterWrite: (() => void) | undefined;
  const runtime: any = { lastError: null, connectNative: () => port };
  const port = {
    postMessage: (message: any) => messages.push(structuredClone(message)),
    onMessage: { addListener: (callback: typeof listener) => { listener = callback; } },
    onDisconnect: { addListener: (callback: typeof disconnect) => { disconnect = callback; } },
  };
  const chrome = {
    runtime,
    storage: { sync: {
      get: (_keys: string[], callback: (settings: Record<string, unknown>) => void) => {
        getActive += 1;
        maxGets = Math.max(maxGets, getActive);
        const finish = () => { getActive -= 1; callback({ ...state }); };
        if (delayReads) pendingRead = finish;
        else queueMicrotask(finish);
      },
      set: (patch: Record<string, unknown>, callback: () => void) => {
        queueMicrotask(() => {
          if (failWrite) runtime.lastError = { message: "quota exceeded" };
          else Object.assign(state, patch);
          callback();
          runtime.lastError = null;
          afterWrite?.();
        });
      },
    } },
  };
  const context: any = { chrome, setTimeout: () => 0, clearTimeout: () => {} };
  runInNewContext(`${source}\nglobalThis.syncTest = { connectGraftNativeHost, postGraftNativeSnapshot, flush: () => graftNativeSyncQueue };`, context);
  const api = context.syncTest;
  return {
    state, messages, api,
    receive: (message: any) => listener(message),
    disconnect: () => disconnect(),
    failWrites: (fail: boolean) => { failWrite = fail; },
    delayReads: (delay: boolean) => { delayReads = delay; },
    finishRead: () => { const finish = pendingRead; pendingRead = undefined; finish?.(); },
    maxGets: () => maxGets,
    afterWrite: (callback: () => void) => { afterWrite = callback; },
  };
}

describe("native settings synchronization", () => {
  it("serializes rapid toggles and acknowledges each exact token after its write", async () => {
    const f = fixture();
    f.api.connectGraftNativeHost();
    await f.api.flush();
    for (const [index, value] of [true, false, true].entries()) {
      f.receive({ type: "applySettings", changes: { forceDarkModeEnabled: value }, tokens: { forceDarkModeEnabled: `token-${index}` }, revision: index + 1 });
      f.api.postGraftNativeSnapshot();
    }
    await f.api.flush();
    const acks = f.messages.filter((message) => message.acknowledgements.forceDarkModeEnabled);
    expect(acks.map((message) => [message.settings.forceDarkModeEnabled, message.acknowledgements.forceDarkModeEnabled]))
      .toEqual([[true, "token-0"], [false, "token-1"], [true, "token-2"]]);
    expect(f.state.forceDarkModeEnabled).toBe(true);
    expect(f.maxGets()).toBe(1);
  });

  it("never acknowledges a failed storage write and can retry the same token", async () => {
    const f = fixture();
    f.api.connectGraftNativeHost();
    await f.api.flush();
    const message = { type: "applySettings", changes: { forceDarkModeEnabled: true }, tokens: { forceDarkModeEnabled: "retry-token" }, revision: 4 };
    f.failWrites(true);
    f.receive(message);
    await f.api.flush();
    expect(f.messages.some((item) => item.acknowledgements.forceDarkModeEnabled)).toBe(false);
    f.failWrites(false);
    f.receive(message);
    await f.api.flush();
    expect(f.messages.filter((item) => item.type === "settingsApplied").at(-1).acknowledgements.forceDarkModeEnabled).toBe("retry-token");
  });

  it("captures the revision before a storage read, and discards reads after disconnect", async () => {
    const f = fixture();
    f.api.connectGraftNativeHost();
    await f.api.flush();
    f.receive({ type: "ready", revision: 10 });
    f.delayReads(true);
    const snapshot = f.api.postGraftNativeSnapshot();
    await Promise.resolve();
    f.receive({ type: "ready", revision: 20 });
    f.finishRead();
    await snapshot;
    expect(f.messages.at(-1).baseRevision).toBe(10);
    const count = f.messages.length;
    const abandoned = f.api.postGraftNativeSnapshot();
    await Promise.resolve();
    f.disconnect();
    f.finishRead();
    await abandoned;
    expect(f.messages).toHaveLength(count);
  });

  it("acknowledges an applied app toggle even if the user changes it before the next read", async () => {
    const f = fixture();
    f.api.connectGraftNativeHost();
    await f.api.flush();
    f.afterWrite(() => { f.state.forceDarkModeEnabled = false; });
    f.receive({ type: "applySettings", changes: { forceDarkModeEnabled: true }, tokens: { forceDarkModeEnabled: "applied" }, revision: 6 });
    await f.api.flush();
    const acknowledgement = f.messages.find((message) => message.type === "settingsApplied");
    expect(acknowledgement.settings.forceDarkModeEnabled).toBe(true);
    expect(acknowledgement.acknowledgements.forceDarkModeEnabled).toBe("applied");
    expect(f.messages.at(-1).settings.forceDarkModeEnabled).toBe(false);
    expect(f.messages.at(-1).baseRevision).toBe(6);
  });
});
