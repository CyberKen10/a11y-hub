"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { extractionSchema, type ExtractionResult } from "@/lib/schemas";
import type { KnowledgeFieldDef } from "@/lib/types";

export interface ExistingMatch {
  id: string;
  title: string;
  summary: string | null;
  content: string;
}

export type ExtractResponse =
  | {
      ok: true;
      proposal: ExtractionResult;
      /** Similar existing item, so the user can update instead of duplicate. */
      existing: ExistingMatch | null;
    }
  | { ok: false; error: string };

/**
 * Converts free text (typed or voice-transcribed) into a structured
 * knowledge-item proposal. The result is ALWAYS reviewed and confirmed by a
 * human before being saved.
 */
export async function extractProposal(rawText: string): Promise<ExtractResponse> {
  await requireProfile("editor");

  const text = rawText.trim().slice(0, 20_000);
  if (text.length < 10) {
    return { ok: false, error: "El texto es demasiado corto para analizarlo." };
  }

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name, description, fields")
    .order("sort_order");

  const typeCatalog = (types ?? [])
    .map((t) => {
      const fields = ((t.fields ?? []) as KnowledgeFieldDef[])
        .map((f) => `${f.key} (${f.label})`)
        .join(", ");
      return `- slug: "${t.slug}" — ${t.name}: ${t.description ?? ""}${
        fields ? ` | Campos específicos: ${fields}` : ""
      }`;
    })
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openai(env.chatModel),
      schema: extractionSchema,
      system: `Eres un asistente que estructura conocimiento para el hub interno de una empresa de accesibilidad digital.
Apartados disponibles (elige el slug más adecuado):
${typeCatalog}

Reglas:
- Conserva TODA la información aportada por la persona; no inventes datos ni completes con conocimiento externo.
- Redacta en español claro con Markdown (usa encabezados ## para secciones si hay suficiente contenido).
- El texto puede venir de un dictado por voz: corrige puntuación y muletillas sin alterar el significado.
- En metadata usa solo las claves de los campos específicos del apartado elegido.`,
      prompt: text,
    });

    // Detect a likely existing item to update instead of duplicating.
    const { data: match } = await supabase
      .from("knowledge_items")
      .select("id, title, summary, content")
      .ilike("title", `%${object.title.slice(0, 60)}%`)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle<ExistingMatch>();

    return { ok: true, proposal: object, existing: match ?? null };
  } catch (error) {
    console.error("[extract] failed", error);
    return {
      ok: false,
      error: "No se pudo analizar el texto. Inténtalo de nuevo.",
    };
  }
}
