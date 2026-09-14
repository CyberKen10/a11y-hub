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
import {
  knowledgeItemsSchema,
  type ExtractionResult,
} from "@/lib/schemas";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import { composerFieldsFor } from "@/lib/approaches";
import {
  BUG_TYPE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
  optionValuesList,
  PLATFORM_OPTIONS,
} from "@/lib/approach-options";
import { hydrateExtractedItem } from "@/lib/extract-hydrate";
import { transcriptToNotes } from "@/lib/transcript";
import type { ComposerDraft, ExistingMatch } from "@/lib/extract-types";
import type { KnowledgeFieldDef } from "@/lib/types";

type ExtractResponse =
  | { ok: true; items: ComposerDraft[] }
  | { ok: false; error: string };

const MAX_CHARS = 40_000;

function fail(stage: ChatStage, error: unknown): ExtractResponse {
  const message = publicAiError(stage, error);
  console.error(`[añadir · ${stage}]`, message);
  return { ok: false, error: message };
}

/**
 * Turns free text (typed, dictated or a file) into one or more fichas.
 * Nothing is saved until a person confirms each one.
 */
export async function extractProposal(rawText: string): Promise<ExtractResponse> {
  const profile = await requireProfile("editor");

  try {
    assertAiConfigured();
  } catch (error) {
    return fail("config", error);
  }

  let text: string;
  try {
    text = transcriptToNotes(rawText).slice(0, MAX_CHARS);
  } catch (error) {
    return fail("request", error);
  }
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
        fields ? `\n  Campos: ${fields}` : ""
      }`;
    })
    .join("\n");

  console.info("[añadir · inicio]", {
    chars: text.length,
    model: chatModelId(),
  });

  let object: { items?: Array<ExtractionResult & { decision: string }> };
  try {
    const result = await generateObject({
      model: chatModel(),
      schema: knowledgeItemsSchema,
      providerOptions: chatProviderOptions(),
      system: `Eres una persona experta en accesibilidad digital. Recibes texto libre: un dictado, notas, acuerdos o un archivo.

Tu trabajo: decidir si hay UN tema o VARIOS, y devolver una ficha por cada tema de conocimiento (máximo 10).

Apartados:
${typeCatalog}

Cómo partir:
- Un solo bug, approach o idea → 1 ficha.
- Varios bugs, acuerdos o temas distintos → 1 ficha por cada uno.
- Mezcla (p. ej. un approach y una metodología) → ficha aparte para cada uno, con el type_slug correcto.

type_slug:
- approaches: cómo tratar un bug/issue concreto (WCAG, plataforma, si se reporta, severidad por cliente).
- metodologias: cómo trabajan o evalúan (pasos, rituales, criterios de auditoría).
- herramientas: decisión de usar/no usar una tool.
- plantillas: un documento o checklist.

Omite saludos, logística, fechas de calendar y repeticiones.

Para cada ficha:
- decision: una frase con el tema.
- type_slug, title, summary, content y metadata completos, listos para revisar.
- Si type_slug es approaches, metadata con valores EXACTOS:
  CP (ids WCAG, p. ej. 1.4.3), Bug Type (${optionValuesList(BUG_TYPE_OPTIONS)}), Platform (${optionValuesList(PLATFORM_OPTIONS)}), Team/UTest/Crownspeak/Barcelo/Pros. (${optionValuesList(COMPANY_STATUS_OPTIONS)}). Elige Low/Medium/High/Critical; N/A si no aplica.
- content en español, Markdown. Approaches: ## Problema, ## Cómo reproducirlo, ## Resultado esperado, ## Resultado actual, ## Enfoque / cómo reportarlo.
- tags: 2 a 5, minúsculas.
- Si no hay fuente URL, sources puede ir vacío.

Si no hay ningún tema de conocimiento, devuelve items: [].`,
      prompt: text,
    });
    object = result.object;
  } catch (error) {
    return fail("extract", error);
  }

  try {
    const items: ComposerDraft[] = [];
    for (const row of object.items ?? []) {
      const typeRow = types.find((t) => t.slug === row.type_slug);
      const proposal = hydrateExtractedItem(
        row,
        (typeRow?.fields ?? []) as KnowledgeFieldDef[]
      );
      if (!proposal.sources.length) {
        proposal.sources = [{ label: "Añadido", url: null }];
      }
      const { data: match, error: matchError } = await supabase
        .from("knowledge_items")
        .select("id, title, summary, content")
        .ilike("title", `%${row.title.slice(0, 60)}%`)
        .neq("status", "archived")
        .limit(1)
        .maybeSingle<ExistingMatch>();
      if (matchError) {
        console.warn("[añadir · hydrate]", matchError.message);
      }
      items.push({
        id: crypto.randomUUID(),
        decision: row.decision,
        proposal,
        existing: match ?? null,
      });
    }

    return { ok: true, items };
  } catch (error) {
    return fail("hydrate", error);
  }
}
