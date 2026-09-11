import { isInternalMetaKey } from "@/lib/approaches";
import type { KnowledgeFieldDef } from "@/lib/types";

export interface IndexableInput {
  summary: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Builds the full text to index: body + summary + typed metadata fields
 * rendered as Markdown sections, so structured fields are also retrievable.
 * Pure function (unit-tested).
 */
export function buildIndexableText(
  item: IndexableInput,
  fieldDefs: KnowledgeFieldDef[]
): string {
  const parts: string[] = [];
  if (item.summary?.trim()) parts.push(item.summary.trim());
  parts.push(item.content.trim());

  const renderValue = (raw: unknown): string =>
    Array.isArray(raw)
      ? raw.map((v) => `- ${String(v)}`).join("\n")
      : String(raw).trim();

  const covered = new Set<string>();
  for (const def of fieldDefs) {
    covered.add(def.key);
    const raw = item.metadata?.[def.key];
    if (raw == null) continue;
    const value = renderValue(raw);
    if (!value) continue;
    parts.push(`## ${def.label}\n${value}`);
  }

  // Extra metadata (e.g. unmapped spreadsheet columns) is indexed too, using
  // the raw key as heading, so nothing imported becomes unsearchable.
  for (const [key, raw] of Object.entries(item.metadata ?? {})) {
    if (covered.has(key) || raw == null || isInternalMetaKey(key)) continue;
    const value = renderValue(raw);
    if (!value) continue;
    parts.push(`## ${key}\n${value}`);
  }

  return parts.join("\n\n");
}
