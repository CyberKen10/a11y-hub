"use server";

import { generateObject } from "ai";
import { requireProfile } from "@/lib/auth";
import { consumeAiQuota } from "@/lib/ai-quota";
import { createClient } from "@/lib/supabase/server";
import {
  assertAiConfigured,
  chatModel,
  chatModelId,
  chatProviderOptions,
} from "@/lib/ai";
import { publicAiError, type ChatStage } from "@/lib/ai-errors";
import { extractionSchema, type ExtractionResult } from "@/lib/schemas";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import { composerFieldsFor } from "@/lib/approaches";
import {
  BUG_TYPE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
  optionValuesList,
  PLATFORM_OPTIONS,
} from "@/lib/approach-options";
import { hydrateExtractedItem } from "@/lib/extract-hydrate";
import type { ExistingMatch } from "@/lib/extract-types";
import type { KnowledgeFieldDef } from "@/lib/types";

type ExtractResponse =
  | {
      ok: true;
      proposal: ExtractionResult;
      existing: ExistingMatch | null;
    }
  | { ok: false; error: string };

function fail(stage: ChatStage, error: unknown): ExtractResponse {
  const message = publicAiError(stage, error);
  console.error(`[ficha · ${stage}]`, message);
  return { ok: false, error: message };
}

/**
 * Converts free text (typed or voice-transcribed) into a structured
 * knowledge-item proposal. The result is ALWAYS reviewed and confirmed by a
 * human before being saved.
 */
export async function extractProposal(rawText: string): Promise<ExtractResponse> {
  const profile = await requireProfile("editor");

  try {
    assertAiConfigured();
  } catch (error) {
    return fail("config", error);
  }

  const text = rawText.trim().slice(0, 20_000);
  if (text.length < 10) {
    return fail("request", "Añade un poco más de texto.");
  }

  try {
    const quota = await consumeAiQuota(profile.id, "extract");
    if (!quota.ok) return fail("quota", quota.message);
  } catch (error) {
    return fail("quota", error);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let types: {
    slug: string;
    name: string;
    description: string | null;
    fields: unknown;
  }[] = [];
  try {
    supabase = await createClient();
    const { data, error } = await supabase
      .from("knowledge_types")
      .select("slug, name, description, fields")
      .in("slug", ACTIVE_TYPE_SLUG_LIST)
      .order("sort_order");
    if (error) throw error;
    types = data ?? [];
    if (types.length === 0) {
      throw new Error(
        "No hay apartados activos (approaches, metodologías, herramientas, plantillas)."
      );
    }
  } catch (error) {
    return fail("catalog", error);
  }

  const typeCatalog = types
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

  console.info("[ficha · inicio]", {
    chars: text.length,
    model: chatModelId(),
  });

  let object: ExtractionResult;
  try {
    const result = await generateObject({
      model: chatModel(),
      schema: extractionSchema,
      providerOptions: chatProviderOptions(),
      system: `Eres una persona experta en accesibilidad digital (QA/audit) que redacta fichas de approach para el hub interno.
Apartados disponibles (elige el slug más adecuado; si hablan de un bug, approach o WCAG, usa "approaches"):
${typeCatalog}

Reglas:
1. El texto suele ser un DICTADO corto. No te limites a transcribirlo: INTERPRETA y completa una ficha usable.
2. Rellena TODO: title, summary, content, tags y TODAS las claves de metadata del apartado. Prohibido dejar un campo en "".
3. Si un dato no está en el mensaje, infiérelo con criterio profesional de accesibilidad (WCAG 2.2, lectores de pantalla, teclado, contraste, formularios, iOS/Android). En Comments di qué inferiste.
4. Conserva lo que sí dijeron (plataforma, cliente, pasos, SC) y no lo contradigas.
5. Redacta en español claro. El content debe ser un approach completo, no un párrafo suelto. Usa Markdown:
   ## Problema
   ## Cómo reproducirlo
   ## Resultado esperado
   ## Resultado actual
   ## Enfoque / cómo reportarlo
6. Approaches — metadata (usa EXACTAMENTE estos valores, nada libre):
   - CP: ids WCAG 2.2 separados por coma, p. ej. "1.4.3, 4.1.2".
   - Bug Type: uno de ${optionValuesList(BUG_TYPE_OPTIONS)}.
   - Platform: uno de ${optionValuesList(PLATFORM_OPTIONS)}.
   - Team, UTest, Crownspeak, Barcelo, Pros.: uno de ${optionValuesList(COMPANY_STATUS_OPTIONS)}. Elige severidad Low, Medium, High o Critical; no dejes "Valid Bug" suelto si puedes estimar el impacto. N/A si no aplica a ese cliente.
   - when_to_use, pros, cons: frases concretas.
7. La persona revisará la propuesta antes de guardar: prioriza una ficha completa y revisable, no campos en blanco.`,
      prompt: text,
    });
    object = result.object;
  } catch (error) {
    return fail("extract", error);
  }

  try {
    const typeRow = types.find((t) => t.slug === object.type_slug);
    const proposal = hydrateExtractedItem(
      object,
      (typeRow?.fields ?? []) as KnowledgeFieldDef[]
    );

    const { data: match, error: matchError } = await supabase
      .from("knowledge_items")
      .select("id, title, summary, content")
      .ilike("title", `%${object.title.slice(0, 60)}%`)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle<ExistingMatch>();
    if (matchError) {
      console.warn("[ficha · hydrate]", matchError.message);
    }

    return { ok: true, proposal, existing: match ?? null };
  } catch (error) {
    return fail("hydrate", error);
  }
}
