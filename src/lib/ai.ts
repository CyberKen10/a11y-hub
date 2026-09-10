import "server-only";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { stagedError } from "@/lib/ai-errors";

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

const GOOGLE_CHAT_DEFAULT = "gemini-3.6-flash";
const GOOGLE_TTS_DEFAULT = "gemini-3.1-flash-tts-preview";
const RETIRED_GEMINI = /^(gemini-1\.5|gemini-2\.0|gemini-2\.5)/;

function resolveGoogleModel(
  requested: string | undefined,
  fallback: string
): string {
  const id = requested?.trim() || fallback;
  if (RETIRED_GEMINI.test(id)) {
    console.warn(
      `[ai] ${id} ya no está disponible para claves nuevas. Usando ${fallback}.`
    );
    return fallback;
  }
  return id;
}

const defaults = {
  openai: {
    chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-5",
    embedding: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    transcribe: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
    tts: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    voice: "nova",
  },
  google: {
    chat: resolveGoogleModel(process.env.GEMINI_CHAT_MODEL, GOOGLE_CHAT_DEFAULT),
    embedding: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
    transcribe: resolveGoogleModel(
      process.env.GEMINI_CHAT_MODEL,
      GOOGLE_CHAT_DEFAULT
    ),
    tts: resolveGoogleModel(process.env.GEMINI_TTS_MODEL, GOOGLE_TTS_DEFAULT),
    voice: "Kore",
  },
} as const;

export function chatModelId(): string {
  return aiProvider === "google" ? defaults.google.chat : defaults.openai.chat;
}

export function embeddingModelId(): string {
  return aiProvider === "google"
    ? defaults.google.embedding
    : defaults.openai.embedding;
}

export function chatModel() {
  return aiProvider === "google"
    ? google(defaults.google.chat)
    : openai(defaults.openai.chat);
}

/** Gemini 3 uses thinkingLevel; budget 0 rompe el chat en 3.x. */
export function chatProviderOptions() {
  if (aiProvider === "google") {
    return { google: { thinkingConfig: { thinkingLevel: "minimal" as const } } };
  }
  return undefined;
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

export function assertAiConfigured(): void {
  if (aiProvider === "google") {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!key) {
      throw stagedError(
        "config",
        "Falta GOOGLE_GENERATIVE_AI_API_KEY en .env.local. Créala en https://aistudio.google.com/app/apikey y reinicia npm run dev."
      );
    }
    if (key.startsWith("http") || key === "AIza..." || key.length < 20) {
      throw stagedError(
        "config",
        "GOOGLE_GENERATIVE_AI_API_KEY no parece una clave válida (debe ser la API key de AI Studio, no una URL)."
      );
    }
    return;
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw stagedError(
      "config",
      "AI_PROVIDER=openai pero falta OPENAI_API_KEY en .env.local."
    );
  }
}

export function aiConfigSummary(): {
  provider: AiProvider;
  chatModel: string;
  embeddingModel: string;
  hasKey: boolean;
} {
  const hasKey =
    aiProvider === "google"
      ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
      : Boolean(process.env.OPENAI_API_KEY?.trim());
  return {
    provider: aiProvider,
    chatModel: chatModelId(),
    embeddingModel: embeddingModelId(),
    hasKey,
  };
}
