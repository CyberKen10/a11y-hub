/**
 * Shared by middleware (Edge) and server code. Does not import secrets.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

export function supabaseUrlError(raw: string | undefined): string | null {
  const value = normalizeSupabaseUrl(raw);
  if (!value) {
    return "Falta NEXT_PUBLIC_SUPABASE_URL.";
  }
  if (value.startsWith("sb_") || value.startsWith("eyJ")) {
    return "NEXT_PUBLIC_SUPABASE_URL no es una clave. Debe ser la Project URL: https://xxxxx.supabase.co";
  }
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".supabase.co")) return null;
    return "NEXT_PUBLIC_SUPABASE_URL debe ser https://xxxxx.supabase.co (la Project URL en Supabase → Settings → API).";
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL no es una URL válida. Usa https://xxxxx.supabase.co";
  }
}

export function supabaseAnonError(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  if (value.startsWith("http")) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY es una URL. Ahí va la anon/publishable key (eyJ… o sb_publishable_…).";
  }
  return null;
}

export function authConfigError(): string | null {
  return (
    supabaseUrlError(process.env.NEXT_PUBLIC_SUPABASE_URL) ??
    supabaseAnonError(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function isHtmlParseError(message: string): boolean {
  return (
    message.includes("DOCTYPE") ||
    message.includes("not valid JSON") ||
    message.includes("Unexpected token")
  );
}
