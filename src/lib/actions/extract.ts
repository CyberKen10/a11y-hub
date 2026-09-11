"use server";

import { generateObject } from "ai";
import { requireProfile } from "@/lib/auth";
import { consumeAiQuota } from "@/lib/ai-quota";
import { createClient } from "@/lib/supabase/server";
import { chatModel, chatProviderOptions } from "@/lib/ai";
import { extractionSchema, type ExtractionResult } from "@/lib/schemas";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import {
  composerFieldsFor,
  withAllComposerMetadata,
} from "@/lib/approaches";
import { parseWcagSuccessCriteria } from "@/lib/wcag";
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
  const profile = await requireProfile("editor");

  const text = rawText.trim().slice(0, 20_000);
  if (text.length < 10) {
    return { ok: false, error: "El texto es demasiado corto para analizarlo." };
  }

  const quota = await consumeAiQuota(profile.id, "extract");
  if (!quota.ok) {
    return { ok: false, error: quota.message };
  }

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name, description, fields")
    .in("slug", ACTIVE_TYPE_SLUG_LIST)
    .order("sort_order");

  const typeCatalog = (types ?? [])
    .map((t) => {
      const defs = composerFieldsFor(
        t.slug,
        (t.fields ?? []) as KnowledgeFieldDef[]
      );
      const fields = defs
        .map((f) => `${f.key} = "${f.label}" (${f.kind}${f.help ? `; ${f.help}` : ""})`)
        .join("; ");
      return `- slug: "${t.slug}" — ${t.name}: ${t.description ?? ""}${
        fields ? `\n  Campos (incluye TODAS estas claves en metadata): ${fields}` : ""
      }`;
    })
    .join("\n");

  try {
    const { object } = await generateObject({
      model: chatModel(),
      schema: extractionSchema,
      providerOptions: chatProviderOptions(),
      system: `Eres un asistente que estructura conocimiento para el hub interno de una empresa de accesibilidad digital.
Apartados disponibles (elige el slug más adecuado):
${typeCatalog}

Reglas:
- Conserva TODA la información aportada por la persona; no inventes datos ni completes con conocimiento externo.
- Redacta en español claro con Markdown (usa encabezados ## para secciones si hay suficiente contenido).
- El texto puede venir de un dictado por voz: corrige puntuación y muletillas sin alterar el significado.
- En metadata DEBES incluir TODAS las claves listadas para el apartado elegido. Si no hay dato, usa "".
- Si el apartado es approaches: extrae los criterios de éxito WCAG (formato 1.4.3, 2.4.4, etc.) en la clave "CP". Si mencionan varios, sepáralos por coma. También rellena Bug Type, Platform, compañías (Team, UTest, Crownspeak, Barcelo, Pros.), Comments, when_to_use, pros y cons cuando el texto lo permita.`,
      prompt: text,
    });

    const typeRow = (types ?? []).find((t) => t.slug === object.type_slug);
    const metadata = withAllComposerMetadata(
      object.type_slug,
      object.metadata,
      (typeRow?.fields ?? []) as KnowledgeFieldDef[]
    );
    const scs = parseWcagSuccessCriteria(metadata.CP);
    if (scs.length > 0) {
      metadata.wcag_refs = scs.join(", ");
    }

    const proposal: ExtractionResult = { ...object, metadata };

    // Detect a likely existing item to update instead of duplicating.
    const { data: match } = await supabase
      .from("knowledge_items")
      .select("id, title, summary, content")
      .ilike("title", `%${object.title.slice(0, 60)}%`)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle<ExistingMatch>();

    return { ok: true, proposal, existing: match ?? null };
  } catch (error) {
    console.error("[extract] failed", error);
    return {
      ok: false,
      error: "No se pudo analizar el texto. Inténtalo de nuevo.",
    };
  }
}
