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
} from "@/lib/element-selector-storage";
import {
  flattenHiddenMap,
  normalizeDomainKey,
  rowKey,
  signaturesMatch,
  type HiddenElementRow,
} from "@/lib/element-selector-hidden";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, MapPin, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OPTIONS_URL = chrome.runtime.getURL("options.html");

export function HiddenElementsApp() {
  const [rows, setRows] = useState<HiddenElementRow[]>([]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    chrome.storage.local.get({ [ELEMENT_SELECTOR_REMOVALS_KEY]: {} }, (r) => {
      const map = r[ELEMENT_SELECTOR_REMOVALS_KEY] as Record<
        string,
        HiddenElementRow[]
      >;
      setRows(flattenHiddenMap(map));
    });
  }, []);

  useEffect(() => {
    load();
    const onChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area === "local" && ELEMENT_SELECTOR_REMOVALS_KEY in changes) {
        load();
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [load]);

  const domains = useMemo(() => {
    const d = new Set(rows.map((r) => r.domain));
    return Array.from(d).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (domainFilter && row.domain !== domainFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = [
        row.domain,
        row.tagName,
        row.id,
        row.primarySelector,
        row.selectorPath,
        row.classes.join(" "),
        row.sourceUrl ?? "",
        row.removedAt ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, domainFilter]);

  const persistMap = (
    next: Record<string, HiddenElementRow[]>,
    message: string
  ) => {
    chrome.storage.local.set({ [ELEMENT_SELECTOR_REMOVALS_KEY]: next }, () => {
      setStatus(message);
      window.setTimeout(() => setStatus(null), 2000);
      load();
    });
  };

  const openOptions = () => {
    chrome.tabs.create({ url: OPTIONS_URL });
  };

  const removeRow = (row: HiddenElementRow) => {
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
      persistMap(next, "Unhid that element for this site.");
    });
  };

  const bulkUnhideDomain = () => {
    if (!domainFilter) {
      setStatus("Pick a site in the filter first.");
      window.setTimeout(() => setStatus(null), 2000);
      return;
    }

    chrome.storage.local.get({ [ELEMENT_SELECTOR_REMOVALS_KEY]: {} }, (r) => {
      const raw = r[ELEMENT_SELECTOR_REMOVALS_KEY] as Record<
        string,
        HiddenElementRow[]
      >;
      const next: Record<string, HiddenElementRow[]> = { ...raw };
      for (const key of Object.keys(next)) {
        if (normalizeDomainKey(key) === domainFilter) {
          delete next[key];
        }
      }
      persistMap(next, `Unhid all hidden elements on ${domainFilter}.`);
    });
  };

  const exportJson = () => {
    chrome.storage.local.get({ [ELEMENT_SELECTOR_REMOVALS_KEY]: {} }, (r) => {
      const blob = new Blob(
        [JSON.stringify(r[ELEMENT_SELECTOR_REMOVALS_KEY] ?? {}, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "graft-hidden-elements.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Exported hidden elements JSON.");
      window.setTimeout(() => setStatus(null), 1600);
    });
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid JSON");
        }
        chrome.storage.local.set(
          { [ELEMENT_SELECTOR_REMOVALS_KEY]: parsed },
          () => {
            setStatus("Imported hidden elements.");
            window.setTimeout(() => setStatus(null), 2000);
            load();
          }
        );
      } catch {
        setStatus("Import failed — invalid JSON file.");
        window.setTimeout(() => setStatus(null), 2400);
      }
    };
    reader.readAsText(file);
  };

  const showOnPage = (row: HiddenElementRow) => {
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hidden elements
          </h1>
          <p className="text-sm text-muted-foreground">
            Elements removed with Element Selector, grouped by site. Unhide to
            show them again, or open a page to see where one was.
          </p>
        </div>
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
      </div>

      <Card className="gap-0 border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
          <CardDescription className="text-sm">
            Narrow the list by site or search selectors, tags, and URLs.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hide-domain">Website</Label>
              <select
                id="hide-domain"
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
              <Label htmlFor="hide-search">Search</Label>
              <input
                id="hide-search"
                type="search"
                placeholder="Selector, tag, id, URL…"
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
              Unhide all on site
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
            List ({filtered.length}
            {filtered.length !== rows.length ? ` of ${rows.length}` : ""})
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {rows.length === 0
                ? "No hidden elements yet. Remove something with Element Selector to see it here."
                : "No rows match your filters."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((row) => (
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
                      onClick={() => showOnPage(row)}
                    >
                      <MapPin className="size-3.5" />
                      Show on page
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => removeRow(row)}
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

      <p className="text-center text-xs text-muted-foreground">
        Tip: keep this tab open while you use &quot;Show on page&quot; — use
        &quot;Back to hide list&quot; on the site to return here.
      </p>
    </main>
  );
}
