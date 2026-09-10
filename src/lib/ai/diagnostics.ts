import "server-only";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import {
  aiConfigSummary,
  assertAiConfigured,
  chatModel,
  chatProviderOptions,
} from "@/lib/ai";
import { embedQuery } from "@/lib/rag/embeddings";
import { publicAiError } from "@/lib/ai-errors";
import type { AiCheck, AiDiagnostics } from "@/lib/ai/types";

export type { AiCheck, AiDiagnostics };

/** Runs isolated checks so a tester can see exactly which layer is broken. */
export async function runAiDiagnostics(): Promise<AiDiagnostics> {
  const checks: AiCheck[] = [];
  const summary = aiConfigSummary();

  try {
    assertAiConfigured();
    checks.push({
      id: "config",
      ok: true,
      title: "Clave de IA",
      detail: `Proveedor ${summary.provider}. Chat: ${summary.chatModel}. Embeddings: ${summary.embeddingModel}.`,
    });
  } catch (error) {
    checks.push({
      id: "config",
      ok: false,
      title: "Clave de IA",
      detail: publicAiError("config", error),
    });
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");
    if (error) throw error;
    checks.push({
      id: "items",
      ok: (count ?? 0) > 0,
      title: "Fichas publicadas",
      detail:
        (count ?? 0) > 0
          ? `${count} elementos publicados.`
          : "No hay fichas publicadas. Importa el Wiki Approaches o publica contenido.",
    });
  } catch (error) {
    checks.push({
      id: "items",
      ok: false,
      title: "Fichas publicadas",
      detail: publicAiError("search", error),
    });
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("chunks")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    checks.push({
      id: "chunks",
      ok: (count ?? 0) > 0,
      title: "Índice RAG (chunks)",
      detail:
        (count ?? 0) > 0
          ? `${count} fragmentos indexados.`
          : "0 fragmentos. El chat puede buscar por palabras, pero el RAG no. Administración → Sincronización → Procesar pendientes.",
    });
  } catch (error) {
    checks.push({
      id: "chunks",
      ok: false,
      title: "Índice RAG (chunks)",
      detail: publicAiError("search", error),
    });
  }

  try {
    const embedding = await embedQuery("campo de email requerido");
    checks.push({
      id: "embed",
      ok: embedding.length === 1536,
      title: "Embeddings Gemini",
      detail: `OK · ${embedding.length} dimensiones (modelo ${summary.embeddingModel}).`,
    });
  } catch (error) {
    checks.push({
      id: "embed",
      ok: false,
      title: "Embeddings Gemini",
      detail: publicAiError("embed", error),
    });
  }

  try {
    const supabase = await createClient();
    const dummy = Array.from({ length: 1536 }, () => 0);
    const { error } = await supabase.rpc("hybrid_search", {
      query_text: "email",
      query_embedding: JSON.stringify(dummy),
      match_count: 1,
      filter_type_slugs: null,
    });
    if (error) throw error;
    checks.push({
      id: "search",
      ok: true,
      title: "Función hybrid_search",
      detail: "La RPC de Postgres respondió. La migración está aplicada.",
    });
  } catch (error) {
    checks.push({
      id: "search",
      ok: false,
      title: "Función hybrid_search",
      detail: publicAiError("search", error),
    });
  }

  try {
    const result = await generateText({
      model: chatModel(),
      providerOptions: chatProviderOptions(),
      prompt: "Responde exactamente: OK",
    });
    checks.push({
      id: "generate",
      ok: Boolean(result.text?.trim()),
      title: "Chat Gemini",
      detail: `OK · modelo ${summary.chatModel} · respuesta: ${result.text.trim().slice(0, 80)}`,
    });
  } catch (error) {
    checks.push({
      id: "generate",
      ok: false,
      title: "Chat Gemini",
      detail: publicAiError("generate", error),
    });
  }

  return { ok: checks.every((c) => c.ok), checks };
}
