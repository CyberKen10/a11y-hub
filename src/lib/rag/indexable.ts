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

  for (const def of fieldDefs) {
    const raw = item.metadata?.[def.key];
    if (raw == null) continue;
    const value = Array.isArray(raw)
      ? raw.map((v) => `- ${String(v)}`).join("\n")
      : String(raw).trim();
    if (!value) continue;
    parts.push(`## ${def.label}\n${value}`);
  }

  return parts.join("\n\n");
}
