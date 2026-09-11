export type AiQuotaKind = "chat" | "transcribe" | "speech" | "extract";

const KIND_LABEL: Record<AiQuotaKind, string> = {
  chat: "preguntas de chat",
  transcribe: "dictados",
  speech: "lecturas en voz alta",
  extract: "usos de Añadir o Acuerdos",
};

const DEFAULT_LIMITS: Record<AiQuotaKind, number> = {
  chat: 20,
  transcribe: 8,
  speech: 8,
  extract: 6,
};

export function aiQuotaLimit(kind: AiQuotaKind): number {
  const envName =
    kind === "chat"
      ? "AI_USER_DAILY_CHAT"
      : kind === "transcribe"
        ? "AI_USER_DAILY_TRANSCRIBE"
        : kind === "speech"
          ? "AI_USER_DAILY_SPEECH"
          : "AI_USER_DAILY_EXTRACT";
  const raw = process.env[envName];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return DEFAULT_LIMITS[kind];
}

export function aiQuotaDeniedMessage(
  kind: AiQuotaKind,
  used: number,
  limit: number
): string {
  return `Has llegado al límite de ${limit} ${KIND_LABEL[kind]} por hoy (${used}/${limit}). Se reinicia a medianoche UTC.`;
}
