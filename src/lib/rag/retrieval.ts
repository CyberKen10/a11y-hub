import "server-only";
import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/rag/embeddings";
import type { RetrievedSource } from "@/lib/types";

export interface RetrievalResult {
  sources: RetrievedSource[];
  /** Numbered context block ready to inject into the system prompt. */
  contextBlock: string;
}

/**
 * Hybrid retrieval: vector similarity + Postgres full-text search fused with
 * Reciprocal Rank Fusion inside the `hybrid_search` SQL function. Runs with
 * the caller's client so Row Level Security applies.
 */
export async function retrieve(
  query: string,
  options: { typeSlugs?: string[] | null; matchCount?: number } = {}
): Promise<RetrievalResult> {
  const { typeSlugs = null, matchCount = 8 } = options;

  const queryEmbedding = await embedQuery(query);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
    filter_type_slugs: typeSlugs && typeSlugs.length > 0 ? typeSlugs : null,
  });

  if (error) {
    throw new Error(`Fallo en la búsqueda híbrida: ${error.message}`);
  }

  const rows = (data ?? []) as {
    chunk_id: string;
    item_id: string;
    item_title: string;
    type_slug: string | null;
    heading: string | null;
    content: string;
    item_updated_at: string | null;
  }[];

  const sources: RetrievedSource[] = rows.map((row, i) => ({
    index: i + 1,
    item_id: row.item_id,
    item_title: row.item_title,
    type_slug: row.type_slug,
    heading: row.heading,
    snippet: row.content,
    updated_at: row.item_updated_at,
  }));

  const contextBlock = sources
    .map(
      (s) =>
        `[${s.index}] "${s.item_title}"${s.heading ? ` — ${s.heading}` : ""}\n${s.snippet}`
    )
    .join("\n\n---\n\n");

  return { sources, contextBlock };
}
