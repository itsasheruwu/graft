import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ELEMENT_SELECTOR_LOCATE_KEY,
  ELEMENT_SELECTOR_REMOVALS_KEY,
  ELEMENT_SELECTOR_REWRITES_KEY,
} from "@/lib/element-selector-storage";
import {
  editedTextRowKey,
  flattenHiddenMap,
  flattenRewriteMap,
  normalizeDomainKey,
  rowKey,
  signaturesMatch,
  type EditedTextRow,
  type HiddenElementRow,
} from "@/lib/element-selector-hidden";
import { cn } from "@/lib/utils";
import { GraftBrand } from "@/components/brand/graft-brand";
import { ArrowLeft, Download, MapPin, Pencil, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OPTIONS_URL = chrome.runtime.getURL("options.html");

type LocateKind = "hidden" | "rewrite";

function truncateText(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}…`;
}

export function EditedListApp() {
  const [hiddenRows, setHiddenRows] = useState<HiddenElementRow[]>([]);
  const [rewriteRows, setRewriteRows] = useState<EditedTextRow[]>([]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    chrome.storage.local.get(
      {
        [ELEMENT_SELECTOR_REMOVALS_KEY]: {},
        [ELEMENT_SELECTOR_REWRITES_KEY]: {},
      },
      (r) => {
        const hiddenMap = r[ELEMENT_SELECTOR_REMOVALS_KEY] as Record<
          string,
          HiddenElementRow[]
        >;
        const rewriteMap = r[ELEMENT_SELECTOR_REWRITES_KEY] as Record<
          string,
          EditedTextRow[]
        >;
        setHiddenRows(flattenHiddenMap(hiddenMap));
        setRewriteRows(flattenRewriteMap(rewriteMap));
      }
    );
  }, []);

  useEffect(() => {
    load();
    const onChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (
        area === "local" &&
        (ELEMENT_SELECTOR_REMOVALS_KEY in changes ||
          ELEMENT_SELECTOR_REWRITES_KEY in changes)
      ) {
        load();
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [load]);

  const domains = useMemo(() => {
    const d = new Set([
      ...hiddenRows.map((r) => r.domain),
      ...rewriteRows.map((r) => r.domain),
    ]);
    return Array.from(d).sort();
  }, [hiddenRows, rewriteRows]);

  const matchesSearch = useCallback(
    (parts: (string | undefined)[]) => {
      const q = search.trim().toLowerCase();
      if (!q) {
        return true;
      }
      return parts.join(" ").toLowerCase().includes(q);
    },
    [search]
  );

  const filteredHidden = useMemo(() => {
    return hiddenRows.filter((row) => {
      if (domainFilter && row.domain !== domainFilter) {
        return false;
      }
      return matchesSearch([
        row.domain,
        row.tagName,
        row.id,
        row.primarySelector,
        row.selectorPath,
        row.classes.join(" "),
        row.sourceUrl ?? "",
        row.removedAt ?? "",
      ]);
    });
  }, [hiddenRows, domainFilter, matchesSearch]);

  const filteredRewrites = useMemo(() => {
    return rewriteRows.filter((row) => {
      if (domainFilter && row.domain !== domainFilter) {
        return false;
      }
      return matchesSearch([
        row.domain,
        row.tagName,
        row.id,
        row.primarySelector,
        row.selectorPath,
        row.classes.join(" "),
        row.sourceUrl ?? "",
        row.rewrittenAt ?? "",
        row.newText,
      ]);
    });
  }, [rewriteRows, domainFilter, matchesSearch]);

  const persistRemovals = (
    next: Record<string, HiddenElementRow[]>,
    message: string
  ) => {
    chrome.storage.local.set({ [ELEMENT_SELECTOR_REMOVALS_KEY]: next }, () => {
      setStatus(message);
      window.setTimeout(() => setStatus(null), 2000);
      load();
    });
  };

  const persistRewrites = (
    next: Record<string, EditedTextRow[]>,
    message: string
  ) => {
    chrome.storage.local.set({ [ELEMENT_SELECTOR_REWRITES_KEY]: next }, () => {
      setStatus(message);
      window.setTimeout(() => setStatus(null), 2000);
      load();
    });
  };

  const openOptions = () => {
    chrome.tabs.create({ url: OPTIONS_URL });
  };

  const removeHiddenRow = (row: HiddenElementRow) => {
    chrome.storage.local.get({ [ELEMENT_SELECTOR_REMOVALS_KEY]: {} }, (r) => {
      const raw = r[ELEMENT_SELECTOR_REMOVALS_KEY] as Record<
        string,
        HiddenElementRow[]
      >;
      const next: Record<string, HiddenElementRow[]> = { ...raw };
      for (const key of Object.keys(next)) {
        if (normalizeDomainKey(key) !== row.domain) {
          continue;
        }
        const list = next[key];
        if (!Array.isArray(list)) {
          continue;
        }
        const filteredList = list.filter((e) => !signaturesMatch(e, row));
        if (filteredList.length === 0) {
          delete next[key];
        } else {
          next[key] = filteredList;
        }
      }
      persistRemovals(next, "Unhid that element for this site.");
    });
  };

  const removeRewriteRow = (row: EditedTextRow) => {
    chrome.storage.local.get({ [ELEMENT_SELECTOR_REWRITES_KEY]: {} }, (r) => {
      const raw = r[ELEMENT_SELECTOR_REWRITES_KEY] as Record<
        string,
        EditedTextRow[]
      >;
      const next: Record<string, EditedTextRow[]> = { ...raw };
      for (const key of Object.keys(next)) {
        if (normalizeDomainKey(key) !== row.domain) {
          continue;
        }
        const list = next[key];
        if (!Array.isArray(list)) {
          continue;
        }
        const filteredList = list.filter((e) => !signaturesMatch(e, row));
        if (filteredList.length === 0) {
          delete next[key];
        } else {
          next[key] = filteredList;
        }
      }
      persistRewrites(
        next,
        "Removed saved text edit. Reload the page to see the original text."
      );
    });
  };

  const bulkUnhideDomain = () => {
    if (!domainFilter) {
      setStatus("Pick a site in the filter first.");
      window.setTimeout(() => setStatus(null), 2000);
      return;
    }

    chrome.storage.local.get(
      {
        [ELEMENT_SELECTOR_REMOVALS_KEY]: {},
        [ELEMENT_SELECTOR_REWRITES_KEY]: {},
      },
      (r) => {
        const hiddenRaw = r[ELEMENT_SELECTOR_REMOVALS_KEY] as Record<
          string,
          HiddenElementRow[]
        >;
        const rewriteRaw = r[ELEMENT_SELECTOR_REWRITES_KEY] as Record<
          string,
          EditedTextRow[]
        >;
        const nextHidden: Record<string, HiddenElementRow[]> = { ...hiddenRaw };
        const nextRewrites: Record<string, EditedTextRow[]> = { ...rewriteRaw };
        for (const key of Object.keys(nextHidden)) {
          if (normalizeDomainKey(key) === domainFilter) {
            delete nextHidden[key];
          }
        }
        for (const key of Object.keys(nextRewrites)) {
          if (normalizeDomainKey(key) === domainFilter) {
            delete nextRewrites[key];
          }
        }
        chrome.storage.local.set(
          {
            [ELEMENT_SELECTOR_REMOVALS_KEY]: nextHidden,
            [ELEMENT_SELECTOR_REWRITES_KEY]: nextRewrites,
          },
          () => {
            setStatus(`Cleared all edits on ${domainFilter}. Reload open tabs to restore original pages.`);
            window.setTimeout(() => setStatus(null), 2800);
            load();
          }
        );
      }
    );
  };

  const exportJson = () => {
    chrome.storage.local.get(
      {
        [ELEMENT_SELECTOR_REMOVALS_KEY]: {},
        [ELEMENT_SELECTOR_REWRITES_KEY]: {},
      },
      (r) => {
        const payload = {
          [ELEMENT_SELECTOR_REMOVALS_KEY]: r[ELEMENT_SELECTOR_REMOVALS_KEY] ?? {},
          [ELEMENT_SELECTOR_REWRITES_KEY]: r[ELEMENT_SELECTOR_REWRITES_KEY] ?? {},
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "graft-edited-list.json";
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus("Exported edited list JSON.");
        window.setTimeout(() => setStatus(null), 1600);
      }
    );
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid JSON");
        }

        const patch: Record<string, unknown> = {};
        if (ELEMENT_SELECTOR_REMOVALS_KEY in parsed) {
          patch[ELEMENT_SELECTOR_REMOVALS_KEY] = parsed[ELEMENT_SELECTOR_REMOVALS_KEY];
        } else if (!(ELEMENT_SELECTOR_REWRITES_KEY in parsed)) {
          patch[ELEMENT_SELECTOR_REMOVALS_KEY] = parsed;
        }
        if (ELEMENT_SELECTOR_REWRITES_KEY in parsed) {
          patch[ELEMENT_SELECTOR_REWRITES_KEY] = parsed[ELEMENT_SELECTOR_REWRITES_KEY];
        }

        if (Object.keys(patch).length === 0) {
          throw new Error("No recognized keys");
        }

        chrome.storage.local.set(patch, () => {
          setStatus("Imported edited list.");
          window.setTimeout(() => setStatus(null), 2000);
          load();
        });
      } catch {
        setStatus("Import failed — invalid JSON file.");
        window.setTimeout(() => setStatus(null), 2400);
      }
    };
    reader.readAsText(file);
  };

  const showOnPage = (
    row: HiddenElementRow | EditedTextRow,
    kind: LocateKind
  ) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const signature = {
      selectorPath: row.selectorPath,
      primarySelector: row.primarySelector,
      tagName: row.tagName,
      id: row.id,
      classes: row.classes,
      sourceUrl: row.sourceUrl ?? "",
    };
    const targetUrl =
      row.sourceUrl && /^https?:\/\//i.test(row.sourceUrl)
        ? row.sourceUrl
        : `https://${row.domain}/`;

    chrome.storage.local.set(
      {
        [ELEMENT_SELECTOR_LOCATE_KEY]: {
          domain: row.domain,
          signature,
          sourceUrl: row.sourceUrl ?? "",
          requestId,
          kind,
          expiresAt: Date.now() + 5 * 60 * 1000,
        },
      },
      () => {
        chrome.tabs.create({ url: targetUrl });
        setStatus("Opened the page — look for the highlighted preview.");
        window.setTimeout(() => setStatus(null), 2400);
      }
    );
  };

  const totalRows = hiddenRows.length + rewriteRows.length;
  const totalFiltered = filteredHidden.length + filteredRewrites.length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <GraftBrand
        variant="page"
        title="Edited list"
        description="Hidden elements and saved text rewrites from Element Selector, grouped by site."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={openOptions}
          >
            <ArrowLeft className="size-3.5" />
            All settings
          </Button>
        }
      />

      <Card className="gap-0 border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
          <CardDescription className="text-sm">
            Narrow the list by site or search selectors, tags, URLs, and text.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edited-domain">Website</Label>
              <select
                id="edited-domain"
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="">All sites</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edited-search">Search</Label>
              <input
                id="edited-search"
                type="search"
                placeholder="Selector, tag, text, URL…"
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!domainFilter}
              onClick={bulkUnhideDomain}
            >
              <Trash2 className="size-3.5" />
              Clear all on site
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={exportJson}
            >
              <Download className="size-3.5" />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Import JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  importJson(file);
                }
                e.target.value = "";
              }}
            />
          </div>
          {status ? (
            <p className="text-sm text-primary" aria-live="polite">
              {status}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-0 border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">
            Hidden elements ({filteredHidden.length}
            {filteredHidden.length !== hiddenRows.length
              ? ` of ${hiddenRows.length}`
              : ""}
            )
          </CardTitle>
          <CardDescription className="text-sm">
            Elements removed with Element Selector. Unhide to show them again.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filteredHidden.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {hiddenRows.length === 0
                ? "No hidden elements yet. Remove something with Element Selector to see it here."
                : "No hidden elements match your filters."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredHidden.map((row) => (
                <li
                  key={rowKey(row)}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {row.domain}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {row.primarySelector || row.selectorPath || row.tagName}
                    </p>
                    {row.sourceUrl ? (
                      <p className="break-all text-xs text-muted-foreground">
                        {row.sourceUrl}
                      </p>
                    ) : null}
                    {row.removedAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Hidden {new Date(row.removedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => showOnPage(row, "hidden")}
                    >
                      <MapPin className="size-3.5" />
                      Show on page
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => removeHiddenRow(row)}
                    >
                      <Trash2 className="size-3.5" />
                      Unhide
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">
            Edited text ({filteredRewrites.length}
            {filteredRewrites.length !== rewriteRows.length
              ? ` of ${rewriteRows.length}`
              : ""}
            )
          </CardTitle>
          <CardDescription className="text-sm">
            Text rewrites saved with &quot;Keep after reload&quot;. Removing an
            edit stops reapplying it; reload the page to restore the original
            text.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filteredRewrites.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {rewriteRows.length === 0
                ? "No saved text edits yet. Rewrite text with Element Selector and check Keep after reload."
                : "No text edits match your filters."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filteredRewrites.map((row) => (
                <li
                  key={editedTextRowKey(row)}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {row.domain}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {row.primarySelector || row.selectorPath || row.tagName}
                    </p>
                    <p className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-sm text-foreground">
                      {truncateText(row.newText)}
                    </p>
                    {row.sourceUrl ? (
                      <p className="break-all text-xs text-muted-foreground">
                        {row.sourceUrl}
                      </p>
                    ) : null}
                    {row.rewrittenAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Saved {new Date(row.rewrittenAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      onClick={() => showOnPage(row, "rewrite")}
                    >
                      <MapPin className="size-3.5" />
                      Show on page
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => removeRewriteRow(row)}
                    >
                      <Pencil className="size-3.5" />
                      Remove edit
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalRows === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Nothing edited yet — use Element Selector on any site to hide elements
          or rewrite text.
        </p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Tip: keep this tab open while you use &quot;Show on page&quot; — use
        &quot;Back to edited list&quot; on the site to return here.
        {totalFiltered > 0 ? ` ${totalFiltered} item${totalFiltered === 1 ? "" : "s"} shown.` : ""}
      </p>
    </main>
  );
}

/** @deprecated Use EditedListApp */
export const HiddenElementsApp = EditedListApp;
