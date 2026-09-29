import { z } from "zod";
import { ACTIVE_TYPE_SLUGS } from "@/lib/knowledge-sections";
import type { ExtractionResult } from "@/lib/schemas";

const sourceSchema = z.object({
  label: z.string().min(1).catch("Fuente"),
  url: z
    .union([z.string().url(), z.null(), z.literal("")])
    .catch(null)
    .transform((value) => (value === "" ? null : value)),
});

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry == null) continue;
    out[key] = typeof entry === "string" ? entry : JSON.stringify(entry);
  }
  return out;
}

const itemSchema = z
  .object({
    decision: z.string().catch(""),
    type_slug: z.enum(ACTIVE_TYPE_SLUGS),
    title: z.string().min(1),
    summary: z.string().catch(""),
    content: z.string().min(1),
    tags: z.array(z.string()).catch([]),
    metadata: z.unknown().catch({}),
    sources: z.array(sourceSchema).catch([]),
  })
  .transform((row) => ({
    ...row,
    metadata: stringRecord(row.metadata),
  }));

export type ExtractedDraftRow = ExtractionResult & { decision: string };

/** Pulls the first JSON object or array out of a model reply. */
export function parseJsonValue(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No object generated: empty response.");
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fence ? fence[1] : trimmed).trim();
  const objectStart = candidate.indexOf("{");
  const arrayStart = candidate.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) {
    throw new Error("No object generated: response did not match schema.");
  }
  const start = Math.min(...starts);
  const endChar = candidate[start] === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(endChar);
  if (end <= start) {
    throw new Error("No object generated: response did not match schema.");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error("No object generated: response did not match schema.");
  }
}

export function parseExtractedItems(text: string): ExtractedDraftRow[] {
  const raw = parseJsonValue(text);
  const payload = Array.isArray(raw) ? { items: raw } : raw;
  const parsed = z
    .object({ items: z.array(itemSchema).max(10) })
    .safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `No object generated: response did not match schema. ${parsed.error.message}`
    );
  }
  return parsed.data.items;
}
