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
  /** Optional: only required when AI_PROVIDER=openai. */
  openaiApiKey: process.env.OPENAI_API_KEY,
  /** Optional: only required when using Gemini (the default). */
  googleGenerativeAiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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
