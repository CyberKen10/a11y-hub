import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkMarkdown } from "@/lib/rag/chunking";
import { embedTexts } from "@/lib/rag/embeddings";
import { buildIndexableText } from "@/lib/rag/indexable";
import type { KnowledgeFieldDef } from "@/lib/types";

/**
 * Re-indexes one item: replaces its chunks and embeddings.
 * Runs with the service role — callers must have verified permissions.
 */
export async function reindexItem(itemId: string): Promise<{ chunks: number }> {
  const admin = createAdminClient();

  const { data: item, error } = await admin
    .from("knowledge_items")
    .select("id, title, summary, content, metadata, status, knowledge_types(fields)")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    throw new Error(`Item ${itemId} no encontrado para indexar.`);
  }

  // Drop existing chunks first — archived/draft items are simply removed
  // from the index.
  await admin.from("chunks").delete().eq("item_id", itemId);

  if (item.status !== "published") {
    return { chunks: 0 };
  }

  const fieldDefs =
    ((item.knowledge_types as unknown as { fields: KnowledgeFieldDef[] } | null)
      ?.fields as KnowledgeFieldDef[]) ?? [];

  let text = buildIndexableText(
    {
      summary: item.summary,
      content: item.content,
      metadata: (item.metadata ?? {}) as Record<string, unknown>,
    },
    fieldDefs
  );

  // Attach extracted text from uploaded files so it is retrievable too.
  const { data: attachments } = await admin
    .from("attachments")
    .select("file_name, extracted_text")
    .eq("item_id", itemId);
  for (const att of attachments ?? []) {
    if (att.extracted_text?.trim()) {
      text += `\n\n## Adjunto: ${att.file_name}\n${att.extracted_text.trim()}`;
    }
  }

  const chunks = chunkMarkdown(text);
  if (chunks.length === 0) return { chunks: 0 };

  // Prefix the item title/heading as context for better embeddings, but
  // store the raw chunk text for display.
  const embedInputs = chunks.map((c) =>
    [
      `Documento: ${item.title}`,
      c.heading ? `Sección: ${c.heading}` : null,
      "",
      c.content,
    ]
      .filter((line) => line !== null)
      .join("\n")
  );

  const embeddings = await embedTexts(embedInputs);

  const rows = chunks.map((c, i) => ({
    item_id: itemId,
    chunk_index: i,
    heading: c.heading,
    content: c.content,
    token_count: c.tokenCount,
    embedding: JSON.stringify(embeddings[i]),
  }));

  const { error: insertError } = await admin.from("chunks").insert(rows);
  if (insertError) {
    throw new Error(`No se pudieron guardar los chunks: ${insertError.message}`);
  }

  return { chunks: rows.length };
}
