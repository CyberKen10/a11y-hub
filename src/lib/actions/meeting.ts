"use server";

import { generateObject } from "ai";
import { requireProfile } from "@/lib/auth";
import { consumeAiQuota } from "@/lib/ai-quota";
import { createClient } from "@/lib/supabase/server";
import { chatModel, chatProviderOptions } from "@/lib/ai";
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
import type { ExistingMatch } from "@/lib/actions/extract";
import type { KnowledgeFieldDef } from "@/lib/types";

export interface MeetingAgreement {
  id: string;
  decision: string;
  proposal: ExtractionResult;
  existing: ExistingMatch | null;
}

export type MeetingExtractResponse =
  | { ok: true; agreements: MeetingAgreement[] }
  | { ok: false; error: string };

const MAX_CHARS = 40_000;

/**
 * Splits meeting notes into knowledge fichas. Nothing is saved until a person
 * confirms each one.
 */
export async function extractMeetingNotes(
  rawText: string
): Promise<MeetingExtractResponse> {
  const profile = await requireProfile("editor");
  const text = transcriptToNotes(rawText).slice(0, MAX_CHARS);
  if (text.length < 40) {
    return {
      ok: false,
      error: "Pega un poco más de texto de la reunión (al menos unas frases).",
    };
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
        fields ? `\n  Campos: ${fields}` : ""
      }`;
    })
    .join("\n");

  try {
    const { object } = await generateObject({
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

    const agreements: MeetingAgreement[] = [];
    for (const row of object.agreements ?? []) {
      const typeRow = (types ?? []).find((t) => t.slug === row.type_slug);
      const proposal = hydrateExtractedItem(
        row,
        (typeRow?.fields ?? []) as KnowledgeFieldDef[]
      );
      if (!proposal.sources.length) {
        proposal.sources = [{ label: "Notas de reunión", url: null }];
      }
      const { data: match } = await supabase
        .from("knowledge_items")
        .select("id, title, summary, content")
        .ilike("title", `%${row.title.slice(0, 60)}%`)
        .neq("status", "archived")
        .limit(1)
        .maybeSingle<ExistingMatch>();
      agreements.push({
        id: crypto.randomUUID(),
        decision: row.decision,
        proposal,
        existing: match ?? null,
      });
    }

    return { ok: true, agreements };
  } catch (error) {
    console.error("[meeting-extract] failed", error);
    return {
      ok: false,
      error: "No se pudieron extraer los acuerdos. Inténtalo de nuevo.",
    };
  }
}
