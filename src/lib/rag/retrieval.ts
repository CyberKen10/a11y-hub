import "server-only";
import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/rag/embeddings";
import { publicAiError } from "@/lib/ai-errors";
import type { RetrievedSource } from "@/lib/types";

export type RetrievalMode = "hybrid" | "keyword" | "empty";

export interface RetrievalResult {
  sources: RetrievedSource[];
  /** Numbered context block ready to inject into the system prompt. */
  contextBlock: string;
  mode: RetrievalMode;
  warnings: string[];
}

/**
 * Hybrid retrieval: vector similarity + Postgres full-text search fused with
 * Reciprocal Rank Fusion inside the `hybrid_search` SQL function. Runs with
 * the caller's client so Row Level Security applies.
 *
 * If embeddings or hybrid_search fail, falls back to a keyword filter on
 * published items so the chat can still answer.
 */
export async function retrieve(
  query: string,
  options: { typeSlugs?: string[] | null; matchCount?: number } = {}
): Promise<RetrievalResult> {
  const { typeSlugs = null, matchCount = 8 } = options;
  const warnings: string[] = [];

  try {
    const queryEmbedding = await embedQuery(query);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: query,
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: matchCount,
      filter_type_slugs: typeSlugs && typeSlugs.length > 0 ? typeSlugs : null,
    });

    if (error) {
      throw new Error(error.message);
    }

    const sources = rowsToSources(data ?? []);
    if (sources.length === 0) {
      warnings.push(
        "La búsqueda híbrida no devolvió fragmentos. Si acabas de importar, procesa los trabajos de indexación en Administración → Sincronización."
      );
    }
    return {
      sources,
      contextBlock: toContext(sources),
      mode: sources.length > 0 ? "hybrid" : "empty",
      warnings,
    };
  } catch (error) {
    const detail = publicAiError("search", error);
    console.error("[chat · búsqueda] híbrida falló, paso a palabras clave:", detail);
    warnings.push(detail);
    return keywordRetrieve(query, { typeSlugs, matchCount, warnings });
  }
}

async function keywordRetrieve(
  query: string,
  options: {
    typeSlugs?: string[] | null;
    matchCount: number;
    warnings: string[];
  }
): Promise<RetrievalResult> {
  const supabase = await createClient();
  const terms = query
    .split(/\s+/)
    .map((w) => w.replace(/[%_,()]/g, "").trim())
    .filter((w) => w.length >= 3)
    .slice(0, 5);

  let typeIds: string[] | null = null;
  if (options.typeSlugs && options.typeSlugs.length > 0) {
    const { data: types, error } = await supabase
      .from("knowledge_types")
      .select("id")
      .in("slug", options.typeSlugs);
    if (error) {
      options.warnings.push(`No se pudieron leer los apartados: ${error.message}`);
    }
    typeIds = (types ?? []).map((t) => t.id);
  }

  let request = supabase
    .from("knowledge_items")
    .select("id, title, summary, content, updated_at, knowledge_types(slug)")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(options.matchCount);

  if (typeIds && typeIds.length > 0) {
    request = request.in("type_id", typeIds);
  }

  if (terms.length > 0) {
    const orFilter = terms
      .flatMap((term) => [
        `title.ilike.%${term}%`,
        `content.ilike.%${term}%`,
        `summary.ilike.%${term}%`,
      ])
      .join(",");
    request = request.or(orFilter);
  }

  const { data, error } = await request;
  if (error) {
    options.warnings.push(`Búsqueda por palabras también falló: ${error.message}`);
    return { sources: [], contextBlock: "", mode: "empty", warnings: options.warnings };
  }

  const rows = data ?? [];
  const sources: RetrievedSource[] = rows.map((row, i) => ({
    index: i + 1,
    item_id: row.id,
    item_title: row.title,
    type_slug:
      (row.knowledge_types as unknown as { slug: string } | null)?.slug ?? null,
    heading: null,
    snippet: (row.summary || row.content || "").slice(0, 1200),
    updated_at: row.updated_at,
  }));

  if (sources.length === 0) {
    options.warnings.push(
      "Ni la búsqueda híbrida ni la de palabras encontraron contenido publicado."
    );
  } else {
    options.warnings.push(
      `Usé búsqueda por palabras (${sources.length} fichas) porque la híbrida/embeddings no funcionó.`
    );
  }

  return {
    sources,
    contextBlock: toContext(sources),
    mode: sources.length > 0 ? "keyword" : "empty",
    warnings: options.warnings,
  };
}

function rowsToSources(
  data: unknown[]
): RetrievedSource[] {
  const rows = data as {
    chunk_id: string;
    item_id: string;
    item_title: string;
    type_slug: string | null;
    heading: string | null;
    content: string;
    item_updated_at: string | null;
  }[];
  return rows.map((row, i) => ({
    index: i + 1,
    item_id: row.item_id,
    item_title: row.item_title,
    type_slug: row.type_slug,
    heading: row.heading,
    snippet: row.content,
    updated_at: row.item_updated_at,
  }));
}

function toContext(sources: RetrievedSource[]): string {
  return sources
    .map(
      (s) =>
        `[${s.index}] "${s.item_title}"${s.heading ? ` — ${s.heading}` : ""}\n${s.snippet}`
    )
    .join("\n\n---\n\n");
}
