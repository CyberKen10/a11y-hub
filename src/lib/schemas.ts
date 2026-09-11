import { z } from "zod";
import { ACTIVE_TYPE_SLUGS } from "@/lib/knowledge-sections";

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
  title: z.string().describe("Título corto y descriptivo del elemento."),
  summary: z
    .string()
    .describe("Resumen de 1 a 3 frases del contenido, en español."),
  content: z
    .string()
    .describe(
      "Cuerpo completo en Markdown, bien estructurado con encabezados (##) cuando aplique. Conserva toda la información aportada sin inventar datos."
    ),
  tags: z
    .array(z.string())
    .describe("Entre 1 y 6 etiquetas cortas en minúsculas."),
  metadata: z
    .record(z.string(), z.string())
    .describe(
      "Campos específicos del apartado (según las definiciones provistas) que se puedan completar con la información dada. Vacío si no aplica."
    ),
  sources: z
    .array(z.object({ label: z.string(), url: z.string().nullable() }))
    .describe("Fuentes mencionadas explícitamente, si las hay."),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}
