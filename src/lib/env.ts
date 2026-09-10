import "server-only";
import { normalizeSupabaseUrl, supabaseUrlError } from "@/lib/supabase/config";

/**
 * Server-only environment access. All secrets stay on the server;
 * only NEXT_PUBLIC_* values ever reach the browser.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    const url = normalizeSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
    const problem = supabaseUrlError(url);
    if (problem) throw new Error(problem);
    return url;
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
