export type HiddenElementSignature = {
  selectorPath: string;
  primarySelector: string;
  tagName: string;
  id: string;
  classes: string[];
  removedAt?: string;
  sourceUrl?: string;
};

export type HiddenElementRow = HiddenElementSignature & {
  domain: string;
};

export function normalizeDomainKey(domain: string): string {
  return String(domain).toLowerCase().replace(/^www\./, "");
}

export function signaturesMatch(
  a: HiddenElementSignature,
  b: HiddenElementSignature
): boolean {
  if (a.primarySelector && b.primarySelector) {
    return a.primarySelector === b.primarySelector;
  }
  if (a.selectorPath && b.selectorPath) {
    return a.selectorPath === b.selectorPath;
  }
  return (
    a.tagName === b.tagName &&
    a.id === b.id &&
    a.classes.join(",") === b.classes.join(",")
  );
}

export function flattenHiddenMap(
  raw: Record<string, HiddenElementSignature[] | unknown> | undefined
): HiddenElementRow[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const rows: HiddenElementRow[] = [];

  for (const key of Object.keys(raw)) {
    const domain = normalizeDomainKey(key);
    const list = raw[key];
    if (!Array.isArray(list)) {
      continue;
    }
    for (const entry of list) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const e = entry as Partial<HiddenElementSignature>;
      if (!e.tagName && !e.primarySelector && !e.selectorPath) {
        continue;
      }
      rows.push({
        domain,
        selectorPath: typeof e.selectorPath === "string" ? e.selectorPath : "",
        primarySelector:
          typeof e.primarySelector === "string" ? e.primarySelector : "",
        tagName: typeof e.tagName === "string" ? e.tagName.toLowerCase() : "",
        id: typeof e.id === "string" ? e.id : "",
        classes: Array.isArray(e.classes)
          ? e.classes.filter(Boolean).map(String)
          : [],
        removedAt: typeof e.removedAt === "string" ? e.removedAt : undefined,
        sourceUrl: typeof e.sourceUrl === "string" ? e.sourceUrl : undefined,
      });
    }
  }

  return rows;
}

export function rowKey(row: HiddenElementRow): string {
  return `${row.domain}|${row.removedAt ?? ""}|${row.primarySelector}|${row.selectorPath}|${row.tagName}|${row.id}`;
}

export type EditedTextSignature = HiddenElementSignature & {
  newText: string;
  rewrittenAt?: string;
};

export type EditedTextRow = EditedTextSignature & {
  domain: string;
};

export function flattenRewriteMap(
  raw: Record<string, EditedTextSignature[] | unknown> | undefined
): EditedTextRow[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const rows: EditedTextRow[] = [];

  for (const key of Object.keys(raw)) {
    const domain = normalizeDomainKey(key);
    const list = raw[key];
    if (!Array.isArray(list)) {
      continue;
    }
    for (const entry of list) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const e = entry as Partial<EditedTextSignature>;
      if (!e.tagName && !e.primarySelector && !e.selectorPath) {
        continue;
      }
      if (typeof e.newText !== "string") {
        continue;
      }
      rows.push({
        domain,
        selectorPath: typeof e.selectorPath === "string" ? e.selectorPath : "",
        primarySelector:
          typeof e.primarySelector === "string" ? e.primarySelector : "",
        tagName: typeof e.tagName === "string" ? e.tagName.toLowerCase() : "",
        id: typeof e.id === "string" ? e.id : "",
        classes: Array.isArray(e.classes)
          ? e.classes.filter(Boolean).map(String)
          : [],
        rewrittenAt:
          typeof e.rewrittenAt === "string" ? e.rewrittenAt : undefined,
        sourceUrl: typeof e.sourceUrl === "string" ? e.sourceUrl : undefined,
        newText: e.newText,
      });
    }
  }

  return rows;
}

export function editedTextRowKey(row: EditedTextRow): string {
  return `${row.domain}|${row.rewrittenAt ?? ""}|${row.newText}|${row.primarySelector}|${row.selectorPath}|${row.tagName}|${row.id}`;
}
