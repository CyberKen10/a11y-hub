import "server-only";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

export type AiProvider = "openai" | "google";

/**
 * Default: Google Gemini (free tier via Google AI Studio).
 * Set AI_PROVIDER=openai to use a paid OpenAI key instead.
 *
 * Embeddings from different providers are not compatible. If you switch,
 * re-index everything from Administración → Sincronización.
 */
export const aiProvider: AiProvider =
  process.env.AI_PROVIDER === "openai" ? "openai" : "google";

const defaults = {
  openai: {
    chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-5",
    embedding: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    transcribe: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
    tts: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    voice: "nova",
  },
  google: {
    chat: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
    embedding: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
    // STT with Gemini runs through the chat model (audio input), see
    // /api/transcribe.
    transcribe: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
    tts: process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts",
    voice: "Kore",
  },
} as const;

export function chatModel() {
  return aiProvider === "google"
    ? google(defaults.google.chat)
    : openai(defaults.openai.chat);
}

export function embeddingModel() {
  return aiProvider === "google"
    ? google.embedding(defaults.google.embedding)
    : openai.embedding(defaults.openai.embedding);
}

/**
 * Provider options for embedding calls. The chunks table uses vector(1536):
 * Gemini's default is 3072 dims, so we request 1536 (Matryoshka truncation).
 */
export function embeddingProviderOptions() {
  if (aiProvider === "google") {
    return { google: { outputDimensionality: 1536 } };
  }
  return undefined;
}

export function speechModel() {
  return aiProvider === "google"
    ? google.speech(defaults.google.tts)
    : openai.speech(defaults.openai.tts);
}

export function ttsVoice(): string {
  return defaults[aiProvider].voice;
}

export function transcriptionModelId(): string {
  return defaults[aiProvider].transcribe;
}

export function openaiTranscriptionModel() {
  return openai.transcription(defaults.openai.transcribe);
}
