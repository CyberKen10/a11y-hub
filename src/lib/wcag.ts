/** WCAG Success Criterion id, e.g. 1.4.3 */
export const WCAG_SC_ID_RE = /^\d{1,2}\.\d{1,2}\.\d{1,2}$/;
const WCAG_SC_IN_TEXT_RE = /\d{1,2}\.\d{1,2}\.\d{1,2}/g;

export function isWcagScId(value: string | null | undefined): value is string {
  return Boolean(value && WCAG_SC_ID_RE.test(value));
}

export function compareWcagSc(a: string, b: string): number {
  const left = a.split(".").map((n) => Number.parseInt(n, 10));
  const right = b.split(".").map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function parseWcagSuccessCriteria(value: unknown): string[] {
  const texts: string[] = [];
  if (typeof value === "string") texts.push(value);
  else if (Array.isArray(value)) {
    for (const part of value) {
      if (part != null && String(part).trim()) texts.push(String(part));
    }
  } else if (value != null && typeof value !== "object") {
    texts.push(String(value));
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const text of texts) {
    const matches = text.match(WCAG_SC_IN_TEXT_RE) ?? [];
    for (const id of matches) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function getRawWcagCp(
  metadata: Record<string, unknown> | null | undefined
): string {
  const raw = metadata?.CP;
  if (raw == null) return "";
  const text = String(raw).trim();
  if (!text || text.toLowerCase() === "n/a") return "";
  return text;
}

/** SCs stored as wiki CP, typed wcag_refs, or the derived wcag_scs list. */
export function getItemWcagSuccessCriteria(
  metadata: Record<string, unknown> | null | undefined
): string[] {
  const ids = [
    ...parseWcagSuccessCriteria(metadata?.CP),
    ...parseWcagSuccessCriteria(metadata?.wcag_refs),
    ...parseWcagSuccessCriteria(metadata?.wcag_scs),
  ];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique.sort(compareWcagSc);
}

export function collectWcagFilterOptions(
  rows: Array<{ metadata?: Record<string, unknown> | null } | null | undefined>
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const id of getItemWcagSuccessCriteria(row?.metadata)) seen.add(id);
  }
  return [...seen].sort(compareWcagSc);
}

export function formatWcagScLabel(id: string): string {
  return `SC ${id}`;
}

export function formatWcagLine(
  metadata: Record<string, unknown> | null | undefined
): string {
  const scs = getItemWcagSuccessCriteria(metadata);
  if (scs.length > 0) return `SC WCAG: ${scs.join(", ")}`;
  const raw = getRawWcagCp(metadata);
  return raw ? `SC WCAG: ${raw}` : "";
}

/** PostgREST `or` clause so one selected SC matches CP, wcag_refs or wcag_scs. */
export function wcagScFilterClause(sc: string): string | null {
  if (!isWcagScId(sc)) return null;
  const bounded = `(^|[^0-9])${sc.replace(/\./g, "\\.")}([^0-9]|$)`;
  return [
    `metadata->>CP.match."${bounded}"`,
    `metadata->wcag_refs.cs.["${sc}"]`,
    `metadata->wcag_scs.cs.["${sc}"]`,
  ].join(",");
}
