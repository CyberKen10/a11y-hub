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
  meetingExtractionSchema,
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
import type { ExistingMatch, MeetingAgreement } from "@/lib/extract-types";
import type { KnowledgeFieldDef } from "@/lib/types";

type MeetingExtractResponse =
  | { ok: true; agreements: MeetingAgreement[] }
  | { ok: false; error: string };

const MAX_CHARS = 40_000;

function fail(stage: ChatStage, error: unknown): MeetingExtractResponse {
  const message = publicAiError(stage, error);
  console.error(`[acuerdos · ${stage}]`, message);
  return { ok: false, error: message };
}

/**
 * Splits meeting notes into knowledge fichas. Nothing is saved until a person
 * confirms each one.
 */
export async function extractMeetingNotes(
  rawText: string
): Promise<MeetingExtractResponse> {
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
  if (text.length < 40) {
    return fail("request", "Pega los acuerdos de la reunión.");
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

  console.info("[acuerdos · inicio]", {
    chars: text.length,
    model: chatModelId(),
  });

  let object: { agreements?: Array<ExtractionResult & { decision: string }> };
  try {
    const result = await generateObject({
      model: chatModel(),
      schema: meetingExtractionSchema,
      providerOptions: chatProviderOptions(),
      system: `Eres una persona experta en accesibilidad digital. Recibes la transcripción o notas de una reunión de equipo.
Tu trabajo: extraer SOLO los acuerdos de conocimiento que deban vivir en el hub (máximo 10).

Apartados:
${typeCatalog}

Qué SÍ extraer:
- Approach: cómo tratar un bug/issue concreto (WCAG, plataforma, si se reporta o no, severidad por cliente).
- Metodología: cómo trabajan o evalúan (pasos, rituales, criterios de auditoría).
- Herramienta: decisión de usar/no usar una tool.
- Plantilla: un documento o checklist acordado.

Qué NO extraer: saludos, logística, fechas de calendar, repeticiones, ideas a medias sin acuerdo.

Para cada acuerdo:
- decision: una frase con lo acordado.
- type_slug: el apartado correcto.
- title, summary, content y metadata completos, listos para revisar.
- Si type_slug es approaches, metadata con valores EXACTOS:
  CP (ids WCAG, p. ej. 1.4.3), Bug Type (${optionValuesList(BUG_TYPE_OPTIONS)}), Platform (${optionValuesList(PLATFORM_OPTIONS)}), Team/UTest/Crownspeak/Barcelo/Pros. (${optionValuesList(COMPANY_STATUS_OPTIONS)}). Elige Low/Medium/High/Critical; N/A si no aplica.
- content en español, Markdown. Approaches: ## Problema, ## Cómo reproducirlo, ## Resultado esperado, ## Resultado actual, ## Enfoque / cómo reportarlo.
- tags: 2 a 5, minúsculas.
- Si no hay fuente URL, sources puede ir vacío.

Si no hay ningún acuerdo de conocimiento, devuelve agreements: [].`,
      prompt: text,
    });
    object = result.object;
  } catch (error) {
    return fail("meeting", error);
  }

  try {
    const agreements: MeetingAgreement[] = [];
    for (const row of object.agreements ?? []) {
      const typeRow = types.find((t) => t.slug === row.type_slug);
      const proposal = hydrateExtractedItem(
        row,
        (typeRow?.fields ?? []) as KnowledgeFieldDef[]
      );
      if (!proposal.sources.length) {
        proposal.sources = [{ label: "Reunión", url: null }];
      }
      const { data: match, error: matchError } = await supabase
        .from("knowledge_items")
        .select("id, title, summary, content")
        .ilike("title", `%${row.title.slice(0, 60)}%`)
        .neq("status", "archived")
        .limit(1)
        .maybeSingle<ExistingMatch>();
      if (matchError) {
        console.warn("[acuerdos · hydrate]", matchError.message);
      }
      agreements.push({
        id: crypto.randomUUID(),
        decision: row.decision,
        proposal,
        existing: match ?? null,
      });
    }

    return { ok: true, agreements };
  } catch (error) {
    return fail("hydrate", error);
  }
}
