import "server-only";
import { embed, embedMany } from "ai";
import { embeddingModel, embeddingModelId, embeddingProviderOptions } from "@/lib/ai";
import { stagedError } from "@/lib/ai-errors";

/** Embeds a batch of texts. Dimension must match chunks.embedding (1536). */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  try {
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values,
      providerOptions: embeddingProviderOptions(),
    });
    return embeddings;
  } catch (error) {
    throw stagedError(
      "embed",
      `No se pudieron generar embeddings (modelo ${embeddingModelId()}). ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function embedQuery(value: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: embeddingModel(),
      value,
      providerOptions: embeddingProviderOptions(),
    });
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Gemini devolvió un embedding vacío.");
    }
    if (embedding.length !== 1536) {
      throw new Error(
        `Dimensión ${embedding.length} (se esperaban 1536). Revisa GEMINI_EMBEDDING_MODEL y outputDimensionality.`
      );
    }
    return embedding;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[")) throw error;
    throw stagedError(
      "embed",
      `No se pudo embeber la pregunta (modelo ${embeddingModelId()}). ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
