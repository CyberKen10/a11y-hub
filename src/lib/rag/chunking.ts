/**
 * Heading-aware Markdown chunking.
 *
 * Strategy (document-structure chunking): split the document at headings,
 * keep each section together, and only split further when a section exceeds
 * the token budget. The current heading is preserved as chunk context.
 */

export interface TextChunk {
  heading: string | null;
  content: string;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Soft maximum tokens per chunk. */
  maxTokens?: number;
  /** Minimum tokens before a chunk is emitted on heading change. */
  minTokens?: number;
}

const DEFAULTS: Required<ChunkOptions> = { maxTokens: 500, minTokens: 20 };

/** Cheap token estimate (≈4 chars per token for es/en text). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxTokens, minTokens } = { ...DEFAULTS, ...options };
  const chunks: TextChunk[] = [];

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    buffer = [];
    if (!content) return;
    const tokens = estimateTokens(content);
    if (tokens < minTokens && chunks.length > 0) {
      // Merge tiny fragments into the previous chunk to avoid noise.
      const prev = chunks[chunks.length - 1];
      prev.content = `${prev.content}\n\n${content}`;
      prev.tokenCount = estimateTokens(prev.content);
      return;
    }
    chunks.push({ heading: currentHeading, content, tokenCount: tokens });
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim() || null;
      continue;
    }

    buffer.push(line);

    // Split oversized sections at paragraph boundaries.
    if (
      estimateTokens(buffer.join("\n")) >= maxTokens &&
      line.trim() === ""
    ) {
      flush();
    }
  }
  flush();

  // Hard-split any chunk that still exceeds the budget (e.g. one huge paragraph).
  const result: TextChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.tokenCount <= maxTokens * 1.5) {
      result.push(chunk);
      continue;
    }
    const sentences = chunk.content.split(/(?<=[.!?])\s+/);
    let part: string[] = [];
    for (const sentence of sentences) {
      part.push(sentence);
      if (estimateTokens(part.join(" ")) >= maxTokens) {
        result.push({
          heading: chunk.heading,
          content: part.join(" ").trim(),
          tokenCount: estimateTokens(part.join(" ")),
        });
        part = [];
      }
    }
    if (part.length > 0) {
      const content = part.join(" ").trim();
      if (content) {
        result.push({
          heading: chunk.heading,
          content,
          tokenCount: estimateTokens(content),
        });
      }
    }
  }

  return result.filter((c) => c.content.length > 0);
}
