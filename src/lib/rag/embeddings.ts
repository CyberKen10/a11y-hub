import "server-only";
import { embed, embedMany } from "ai";
import { embeddingModel, embeddingProviderOptions } from "@/lib/ai";

/** Embeds a batch of texts. Dimension must match chunks.embedding (1536). */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values,
    providerOptions: embeddingProviderOptions(),
  });
  return embeddings;
}

export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value,
    providerOptions: embeddingProviderOptions(),
  });
  return embedding;
}
