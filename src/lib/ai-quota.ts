import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aiQuotaDeniedMessage,
  aiQuotaLimit,
  type AiQuotaKind,
} from "@/lib/ai-quota-limits";

export {
  aiQuotaDeniedMessage,
  aiQuotaLimit,
  type AiQuotaKind,
} from "@/lib/ai-quota-limits";

export type AiQuotaResult =
  | { ok: true; used: number; limit: number }
  | { ok: false; used: number; limit: number; message: string };

function asQuotaPayload(
  value: unknown
): { ok?: boolean; used?: number; limit?: number } | null {
  if (!value || typeof value !== "object") return null;
  return value as { ok?: boolean; used?: number; limit?: number };
}

function isMissingQuotaInfra(message: string): boolean {
  return /does not exist|42P01|42883/i.test(message);
}

/**
 * Spends one unit of the caller's daily quota for this AI action.
 * Requires supabase/migrations/20260911000000_ai_usage_daily.sql.
 */
export async function consumeAiQuota(
  userId: string,
  kind: AiQuotaKind
): Promise<AiQuotaResult> {
  const limit = aiQuotaLimit(kind);
  if (limit <= 0) {
    return { ok: false, used: 0, limit, message: aiQuotaDeniedMessage(kind, 0, limit) };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("try_consume_ai_quota", {
      p_user: userId,
      p_kind: kind,
      p_limit: limit,
    });
    if (error) throw error;
    const payload = asQuotaPayload(data);
    const used = typeof payload?.used === "number" ? payload.used : 0;
    if (payload?.ok !== true) {
      return {
        ok: false,
        used,
        limit,
        message: aiQuotaDeniedMessage(kind, used || limit, limit),
      };
    }
    return { ok: true, used, limit };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ai-quota]", message);
    if (kind === "chat") {
      const fallback = await consumeChatQuotaFromMessages(userId, limit);
      if (fallback) return fallback;
    }
    if (isMissingQuotaInfra(message)) {
      return { ok: true, used: 0, limit };
    }
    return {
      ok: false,
      used: limit,
      limit,
      message: aiQuotaDeniedMessage(kind, limit, limit),
    };
  }
}

/** Fallback if the quota table is not migrated yet. */
async function consumeChatQuotaFromMessages(
  userId: string,
  limit: number
): Promise<AiQuotaResult | null> {
  try {
    const admin = createAdminClient();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count, error } = await admin
      .from("messages")
      .select("id, conversations!inner(user_id)", { count: "exact", head: true })
      .eq("conversations.user_id", userId)
      .eq("role", "user")
      .gte("created_at", start.toISOString());
    if (error) return null;
    const used = count ?? 0;
    if (used >= limit) {
      return {
        ok: false,
        used,
        limit,
        message: aiQuotaDeniedMessage("chat", used, limit),
      };
    }
    return { ok: true, used: used + 1, limit };
  } catch {
    return null;
  }
}
