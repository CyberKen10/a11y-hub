import "server-only";

/**
 * Server-only environment access. All secrets stay on the server;
 * only NEXT_PUBLIC_* values ever reach the browser.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-5",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-transcribe",
  ttsModel: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    sheetId: process.env.GOOGLE_SHEET_ID,
  },
} as const;

export function isSheetsConfigured(): boolean {
  return Boolean(
    env.google.serviceAccountEmail && env.google.privateKey && env.google.sheetId
  );
}
