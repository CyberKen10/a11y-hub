import { z } from "zod";
import { ACTIVE_TYPE_SLUGS } from "@/lib/knowledge-sections";
import {
  BUG_TYPE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
  optionValuesList,
  PLATFORM_OPTIONS,
} from "@/lib/approach-options";

export const itemStatusSchema = z.enum(["draft", "published", "archived"]);

export const sourceRefSchema = z.object({
  label: z.string().min(1).max(500),
  url: z.string().url().nullable().or(z.literal("").transform(() => null)),
});

/** Input accepted when creating or updating a knowledge item. */
export const knowledgeItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  type_slug: z.enum(ACTIVE_TYPE_SLUGS),
  title: z.string().min(3, "El título debe tener al menos 3 caracteres.").max(300),
  summary: z.string().max(1000).optional().default(""),
  content: z.string().min(1, "El contenido no puede estar vacío.").max(100_000),
  metadata: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().min(1).max(60)).max(20).default([]),
  sources: z.array(sourceRefSchema).max(30).default([]),
  status: itemStatusSchema.default("draft"),
});

export type KnowledgeItemInput = z.infer<typeof knowledgeItemInputSchema>;

const filled = (description: string) =>
  z.string().describe(`${description} NUNCA lo dejes vacío: si no está en el dictado, interprétalo.`);

/** Approach ficha keys the model must always output. */
export const approachComposerMetadataSchema = z.object({
  CP: filled(
    "Ids WCAG 2.2 separados por coma, p. ej. 1.4.3, 4.1.2. Solo códigos, sin el nombre largo."
  ),
  when_to_use: filled("Cuándo usar este approach, en 1–3 frases."),
  pros: filled("Ventajas, separadas por coma o punto y coma."),
  cons: filled("Limitaciones o excepciones, separadas por coma o punto y coma."),
  "Bug Type": filled(`Uno de: ${optionValuesList(BUG_TYPE_OPTIONS)}.`),
  Platform: filled(`Uno de: ${optionValuesList(PLATFORM_OPTIONS)}.`),
  Team: filled(`Uno de: ${optionValuesList(COMPANY_STATUS_OPTIONS)}.`),
  UTest: filled(`Uno de: ${optionValuesList(COMPANY_STATUS_OPTIONS)}.`),
  Crownspeak: filled(`Uno de: ${optionValuesList(COMPANY_STATUS_OPTIONS)}.`),
  Barcelo: filled(`Uno de: ${optionValuesList(COMPANY_STATUS_OPTIONS)}.`),
  "Pros.": filled(`Uno de: ${optionValuesList(COMPANY_STATUS_OPTIONS)}.`),
  Comments: filled(
    "Notas: qué vino del dictado y qué inferiste. Indica con claridad lo inferido."
  ),
});

/**
 * Structured extraction target used when the assistant converts a free-form
 * prompt or a voice transcription into a knowledge item proposal.
 */
export const extractionSchema = z.object({
  type_slug: z
    .enum(ACTIVE_TYPE_SLUGS)
    .describe(
      "Slug del apartado más adecuado para este contenido, elegido de la lista provista."
    ),
  title: z.string().describe("Título corto y descriptivo del elemento. Nunca vacío."),
  summary: z
    .string()
    .describe(
      "Resumen de 2 a 4 frases en español, completo aunque el dictado sea breve. Nunca vacío."
    ),
  content: z
    .string()
    .describe(
      "Cuerpo completo en Markdown con ## Problema, ## Cómo reproducirlo, ## Resultado esperado, ## Resultado actual, ## Enfoque / cómo reportarlo. Amplía e interpreta el dictado; no lo copies tal cual. Nunca vacío."
    ),
  tags: z
    .array(z.string())
    .describe("Entre 3 y 6 etiquetas cortas en minúsculas."),
  metadata: approachComposerMetadataSchema.describe(
    "Ficha completa. Todas las claves son obligatorias; infiere lo que no se haya dictado."
  ),
  sources: z
    .array(z.object({ label: z.string(), url: z.string().nullable() }))
    .describe("Fuentes mencionadas explícitamente, si las hay."),
});

export type ExtractionResult = Omit<
  z.infer<typeof extractionSchema>,
  "metadata"
> & {
  metadata: Record<string, string>;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}
