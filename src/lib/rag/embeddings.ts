import "server-only";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { env } from "@/lib/env";

/** Embeds a batch of texts. Dimension must match chunks.embedding (1536). */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({
    model: openai.embedding(env.embeddingModel),
    values,
  });
  return embeddings;
}

export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(env.embeddingModel),
    value,
  });
  return embedding;
}
