import "server-only";
import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/rag/embeddings";
import { publicAiError } from "@/lib/ai-errors";
import {
  APPROVAL_LABEL,
  formatSourceFicha,
  getApprovalState,
  queryPrefersPending,
  type ApprovalState,
} from "@/lib/approaches";
import { applyApprovalBoost, CHAT_TOP_DOCS, topDocumentsByScore } from "@/lib/rag/rank";
import { resolveTypeSlugs } from "@/lib/knowledge-sections";
import type { RetrievedSource } from "@/lib/types";

export { CHAT_TOP_DOCS, topDocumentsByScore } from "@/lib/rag/rank";

export type RetrievalMode = "hybrid" | "keyword" | "empty";

/** Extra chunks so the top 3 can be distinct documents, not 3 slices of one. */
const CHAT_CANDIDATE_CHUNKS = 15;

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
  const { typeSlugs = null, matchCount = CHAT_TOP_DOCS } = options;
  const warnings: string[] = [];
  const activeSlugs = resolveTypeSlugs(typeSlugs);
  if (typeSlugs && typeSlugs.length > 0 && activeSlugs.length === 0) {
    return {
      sources: [],
      contextBlock: "",
      mode: "empty",
      warnings: ["Ese apartado ya no forma parte del hub."],
    };
  }

  try {
    const queryEmbedding = await embedQuery(query);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: query,
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: Math.max(matchCount, CHAT_CANDIDATE_CHUNKS),
      filter_type_slugs: activeSlugs,
    });

    if (error) {
      throw new Error(error.message);
    }

    const candidates = searchRows(data ?? []);
    const metaById = await loadItemMeta(
      supabase,
      candidates.map((row) => row.item_id)
    );
    const ranked = topDocumentsByScore(
      applyApprovalBoost(
        candidates,
        approvalMap(metaById),
        queryPrefersPending(query)
      ),
      matchCount
    );
    const sources = rowsToSources(ranked, metaById);
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
    return keywordRetrieve(query, { typeSlugs: activeSlugs, matchCount, warnings });
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
    .select("id, title, summary, content, updated_at, metadata, knowledge_types(slug)")
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

  const preferPending = queryPrefersPending(query);
  const scored = applyApprovalBoost(
    (data ?? []).map((row, i) => ({
      item_id: row.id as string,
      score: 1 - i * 0.01,
      row,
    })),
    new Map(
      (data ?? []).map((row) => [
        row.id as string,
        getApprovalState((row.metadata ?? {}) as Record<string, unknown>),
      ])
    ),
    preferPending
  ).sort((a, b) => b.score - a.score);

  const sources: RetrievedSource[] = scored.map(({ row }, i) =>
    withApproval(
      {
        index: i + 1,
        item_id: row.id as string,
        item_title: row.title as string,
        type_slug:
          (row.knowledge_types as unknown as { slug: string } | null)?.slug ?? null,
        heading: null,
        snippet: ((row.summary || row.content || "") as string).slice(0, 1200),
        updated_at: (row.updated_at as string | null) ?? null,
      },
      (row.metadata ?? {}) as Record<string, unknown>
    )
  );

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

interface SearchRow {
  chunk_id: string;
  item_id: string;
  item_title: string;
  type_slug: string | null;
  heading: string | null;
  content: string;
  item_updated_at: string | null;
  score: number;
}

function searchRows(data: unknown[]): SearchRow[] {
  return (data as SearchRow[]).map((row) => ({
    ...row,
    score: typeof row.score === "number" ? row.score : 0,
  }));
}

function rowsToSources(
  rows: SearchRow[],
  metaById: Map<string, Record<string, unknown>>
): RetrievedSource[] {
  return rows.map((row, i) =>
    withApproval(
      {
        index: i + 1,
        item_id: row.item_id,
        item_title: row.item_title,
        type_slug: row.type_slug,
        heading: row.heading,
        snippet: row.content,
        updated_at: row.item_updated_at,
      },
      metaById.get(row.item_id) ?? {}
    )
  );
}

function withApproval(
  source: RetrievedSource,
  metadata: Record<string, unknown>
): RetrievedSource {
  const state = getApprovalState(metadata);
  return {
    ...source,
    approval_state: state,
    approval_label: APPROVAL_LABEL[state],
    ficha: formatSourceFicha(metadata),
  };
}

async function loadItemMeta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Record<string, unknown>>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from("knowledge_items")
    .select("id, metadata")
    .in("id", unique);
  for (const row of data ?? []) {
    map.set(row.id, (row.metadata ?? {}) as Record<string, unknown>);
  }
  return map;
}

function approvalMap(
  metaById: Map<string, Record<string, unknown>>
): Map<string, ApprovalState> {
  return new Map(
    [...metaById.entries()].map(([id, meta]) => [id, getApprovalState(meta)])
  );
}

function toContext(sources: RetrievedSource[]): string {
  return sources
    .map((s) => {
      const ficha = s.ficha ? `${s.ficha}\n` : "";
      return `[${s.index}] "${s.item_title}"${s.heading ? ` — ${s.heading}` : ""}\n${ficha}${s.snippet}`;
    })
    .join("\n\n---\n\n");
}
