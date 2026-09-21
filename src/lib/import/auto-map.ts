import { ACTIVE_TYPE_SLUGS, type ActiveTypeSlug } from "@/lib/knowledge-sections";

const TITLE_ALIASES = [
  "título",
  "titulo",
  "title",
  "nombre",
  "name",
  "bug description / topic",
  "bug description",
  "topic",
  "ficha",
];

const SUMMARY_ALIASES = ["resumen", "summary", "abstract"];

const CONTENT_ALIASES = [
  "contenido",
  "content",
  "descripción",
  "descripcion",
  "description",
  "approach to be followed",
  "detalle",
  "body",
];

const TAGS_ALIASES = ["tags", "etiquetas", "tag", "labels"];

function norm(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findAlias(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => norm(h));
  for (const alias of aliases) {
    const i = lower.indexOf(alias);
    if (i >= 0) return i;
  }
  for (const alias of aliases) {
    const i = lower.findIndex((h) => h.includes(alias));
    if (i >= 0) return i;
  }
  return -1;
}

export function detectHeaderRow(
  rows: { rowNumber: number; values: string[] }[]
): number {
  const sample = rows.slice(0, 8);
  let best = sample[0]?.rowNumber ?? 1;
  let bestScore = -1;
  for (const row of sample) {
    const filled = row.values.filter((v) => String(v).trim()).length;
    const joined = row.values.map((v) => norm(String(v))).join(" ");
    let score = filled;
    if (TITLE_ALIASES.some((a) => joined.includes(a))) score += 12;
    if (CONTENT_ALIASES.some((a) => joined.includes(a))) score += 6;
    if (score > bestScore) {
      bestScore = score;
      best = row.rowNumber;
    }
  }
  return best;
}

export function autoMapColumns(headers: string[]): {
  titleIdx: number;
  summaryIdx: number;
  contentIdx: number;
  tagsIdx: number;
} {
  let titleIdx = findAlias(headers, TITLE_ALIASES);
  if (titleIdx < 0) {
    titleIdx = headers.findIndex((h) => String(h).trim());
  }
  return {
    titleIdx,
    summaryIdx: findAlias(headers, SUMMARY_ALIASES),
    contentIdx: findAlias(headers, CONTENT_ALIASES),
    tagsIdx: findAlias(headers, TAGS_ALIASES),
  };
}

export function inferTypeSlug(tabName: string): ActiveTypeSlug {
  const n = tabName.toLowerCase();
  if (/metodolog/.test(n)) return "metodologias";
  if (/herramient|tool/.test(n)) return "herramientas";
  if (/plantilla|template|checklist/.test(n)) return "plantillas";
  if (/deque/.test(n)) return "deque";
  if ((ACTIVE_TYPE_SLUGS as readonly string[]).includes(n)) {
    return n as ActiveTypeSlug;
  }
  return "approaches";
}

export function shouldSkipTab(name: string): boolean {
  return /^(leeme|léeme|readme|change log|changelog|sources|hub ·)/i.test(
    name.trim()
  );
}

/** Accepts a Google Sheets URL or a raw spreadsheet ID. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  if (/^[a-zA-Z0-9-_]{30,}$/.test(trimmed)) return trimmed;
  return null;
}
