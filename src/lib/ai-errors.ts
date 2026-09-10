export type ChatStage =
  | "auth"
  | "request"
  | "config"
  | "embed"
  | "search"
  | "generate"
  | "persist"
  | "transcribe"
  | "speech";

const STAGE_LABEL: Record<ChatStage, string> = {
  auth: "sesión",
  request: "petición",
  config: "configuración",
  embed: "embeddings",
  search: "búsqueda",
  generate: "Gemini (respuesta)",
  persist: "guardar conversación",
  transcribe: "dictado",
  speech: "lectura en voz alta",
};

/** Removes API keys and tokens so messages are safe to show in the UI. */
export function sanitizeAiError(text: string): string {
  return text
    .replace(/key=([^&\s]+)/gi, "key=***")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "AIza***")
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, "sk-***")
    .replace(/sb_secret_[A-Za-z0-9_]+/g, "sb_secret_***")
    .replace(/sb_publishable_[A-Za-z0-9_]+/g, "sb_publishable_***")
    .slice(0, 800);
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function hintFor(message: string): string | null {
  const m = message.toLowerCase();
  if (
    m.includes("no longer available to new users") ||
    m.includes("models/gemini-2.5")
  ) {
    return "El modelo de chat está retirado para claves nuevas. El hub ya usa gemini-3.6-flash; recarga y vuelve a Diagnosticar IA. Si en .env.local tienes GEMINI_CHAT_MODEL=gemini-2.5-flash, bórralo o cámbialo.";
  }
  if (
    m.includes("api key is missing") ||
    m.includes("google_generative_ai_api_key") ||
    m.includes("openai_api_key")
  ) {
    return "Falta la clave de IA en .env.local. Añade GOOGLE_GENERATIVE_AI_API_KEY (aistudio.google.com/app/apikey) y reinicia npm run dev.";
  }
  if (m.includes("401") || m.includes("403") || m.includes("invalid api key") || m.includes("api_key_invalid")) {
    return "La clave de Gemini/OpenAI es inválida o está restringida. Revisa GOOGLE_GENERATIVE_AI_API_KEY.";
  }
  if (
    m.includes("429") ||
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate")
  ) {
    return "Cupo o límite de Gemini (capa gratuita: pocas peticiones por minuto). Espera un minuto y reintenta.";
  }
  if (m.includes("404") || m.includes("not found") || m.includes("is not found")) {
    return "El modelo no existe o no está habilitado para esta clave. Prueba GEMINI_CHAT_MODEL=gemini-flash-latest.";
  }
  if (m.includes("hybrid_search") || (m.includes("function") && m.includes("does not exist"))) {
    return "Falta la función SQL hybrid_search. Ejecuta supabase/migrations/20260910000000_init.sql en el SQL Editor de Supabase.";
  }
  if (m.includes("dimension") || m.includes("1536") || m.includes("3072") || m.includes("vector")) {
    return "La dimensión del embedding no coincide con pgvector (1536). Reindexa tras cambiar de modelo.";
  }
  if (m.includes("failed to fetch") || m.includes("enotfound") || m.includes("fetch failed")) {
    return "No hubo red hacia Google o Supabase. Revisa conexión e internet.";
  }
  if (m.includes("doctype") || m.includes("<html") || m.includes("not valid json")) {
    return "El servidor devolvió HTML en vez de la respuesta del chat (error 500). Mira la terminal de npm run dev.";
  }
  return null;
}

/** User-facing error tagged with the pipeline stage that failed. */
export function publicAiError(stage: ChatStage, error: unknown): string {
  const raw = sanitizeAiError(rawMessage(error));
  if (/^\[.+\] /.test(raw)) return raw;
  const hint = hintFor(raw);
  const head = `[${STAGE_LABEL[stage]}]`;
  if (hint) return `${head} ${hint} Detalle: ${raw}`;
  return `${head} ${raw}`;
}

export function stagedError(stage: ChatStage, error: unknown): Error {
  return new Error(publicAiError(stage, error));
}

/** Turns a useChat/fetch failure into a readable message (handles Next.js HTML 500s). */
export function formatClientChatError(error: unknown): string {
  const raw = rawMessage(error);
  if (!raw.trim()) {
    return "[chat] Falló sin mensaje. Abre la terminal de npm run dev y busca líneas [chat].";
  }
  if (/doctype|<\/?html/i.test(raw)) {
    return publicAiError(
      "generate",
      "El servidor devolvió una página HTML (error interno). Revisa la terminal de npm run dev."
    );
  }
  if (raw === "An error occurred.") {
    return "[Gemini (respuesta)] Error genérico del stream. Casi siempre es el modelo (gemini-2.5-flash ya no está disponible). Recarga, pulsa Diagnosticar IA y reintenta.";
  }
  return sanitizeAiError(raw);
}
