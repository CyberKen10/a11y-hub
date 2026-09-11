export type ChatStage =
  | "auth"
  | "request"
  | "config"
  | "quota"
  | "embed"
  | "search"
  | "generate"
  | "persist"
  | "transcribe"
  | "speech"
  | "catalog"
  | "extract"
  | "meeting"
  | "hydrate";

const STAGE_LABEL: Record<ChatStage, string> = {
  auth: "sesión",
  request: "petición",
  config: "configuración",
  quota: "cupo diario",
  embed: "embeddings",
  search: "búsqueda",
  generate: "Gemini (respuesta)",
  persist: "guardar conversación",
  transcribe: "dictado",
  speech: "lectura en voz alta",
  catalog: "apartados",
  extract: "crear ficha",
  meeting: "organizar acuerdos",
  hydrate: "preparar fichas",
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function issueList(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines = value.slice(0, 6).map((issue) => {
    const row = asRecord(issue);
    const path = Array.isArray(row?.path) ? row.path.join(".") : "";
    const message =
      typeof row?.message === "string" ? row.message : String(issue);
    return path ? `${path}: ${message}` : message;
  });
  return `esquema: ${lines.join("; ")}`;
}

function googleApiMessage(error: unknown): string | null {
  const data = asRecord(asRecord(error)?.data)?.error ?? asRecord(error)?.error;
  const inner = asRecord(data);
  if (!inner) return null;
  const message = typeof inner.message === "string" ? inner.message : null;
  if (!message) return null;
  const status = typeof inner.status === "string" ? inner.status : null;
  return status ? `${status}: ${message}` : message;
}

function rawMessage(error: unknown, depth = 0): string {
  if (typeof error === "string") return error;
  if (error == null) return "";
  if (depth > 4) return "";

  const record = asRecord(error);
  const parts: string[] = [];

  if (error instanceof Error && error.message) parts.push(error.message);
  else if (typeof record?.message === "string") parts.push(record.message);

  if (typeof record?.statusCode === "number") {
    parts.push(`HTTP ${record.statusCode}`);
  } else if (typeof record?.status === "number") {
    parts.push(`HTTP ${record.status}`);
  }
  if (typeof record?.code === "string" && record.code.length < 80) {
    parts.push(record.code);
  }
  if (typeof record?.finishReason === "string") {
    parts.push(`fin: ${record.finishReason}`);
  }

  const google = googleApiMessage(error);
  if (google) parts.push(google);

  const issues =
    issueList(record?.issues) ??
    issueList(asRecord(record?.cause)?.issues);
  if (issues) parts.push(issues);

  const extraText = [record?.text, record?.responseBody].find(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  if (typeof extraText === "string" && extraText.length < 300) {
    parts.push(extraText);
  }

  if (record?.cause && record.cause !== error) {
    const nested = rawMessage(record.cause, depth + 1);
    if (nested && !parts.join(" ").includes(nested.slice(0, 60))) {
      parts.push(nested);
    }
  }

  const unique = [...new Set(parts.filter(Boolean))];
  if (unique.length > 0) return unique.join(" · ");

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function hintFor(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("por hoy") && m.includes("medianoche utc")) {
    return null;
  }
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
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("deadline") ||
    m.includes("aborted") ||
    m.includes("etimedout") ||
    m.includes("http 504") ||
    m.includes("http 499")
  ) {
    return "Se agotó el tiempo. Acorta el texto y reintenta.";
  }
  if (
    m.includes("no object generated") ||
    m.includes("did not match schema") ||
    m.includes("typevalidation") ||
    m.includes("esquema:")
  ) {
    return "La respuesta no encajó en el formato de las fichas. Suele pasar con textos muy largos. Acorta los acuerdos o pégalos en dos tandas.";
  }
  if (
    m.includes("fin: length") ||
    m.includes("max_tokens") ||
    m.includes("max tokens") ||
    m.includes("token") && m.includes("limit")
  ) {
    return "La respuesta se cortó por longitud. Pega menos acuerdos a la vez.";
  }
  if (
    m.includes("safety") ||
    m.includes("blocked") ||
    m.includes("prohibited") ||
    m.includes("finishreason") && m.includes("safety")
  ) {
    return "El proveedor bloqueó el texto. Revisa si hay contenido recortado o extraño y reintenta.";
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
  return `${head} ${raw || "Falló sin mensaje. Revisa la terminal de npm run dev."}`;
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

/** Server Actions that time out never reach the catch on the server. */
export function formatClientActionError(stage: ChatStage, error: unknown): string {
  const raw = rawMessage(error);
  if (
    !raw.trim() ||
    raw === "An error occurred." ||
    /server action|unexpected response|body.*interrupt|failed to find/i.test(raw)
  ) {
    return publicAiError(
      stage,
      "Se cortó la petición (tiempo o red). Acorta el texto y reintenta."
    );
  }
  if (/doctype|<\/?html/i.test(raw)) {
    return publicAiError(
      stage,
      "El servidor devolvió una página de error. Revisa la terminal de npm run dev."
    );
  }
  return publicAiError(stage, error);
}
