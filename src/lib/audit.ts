import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}

/** Best-effort audit trail — a logging failure never breaks the main flow. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      detail: input.detail ?? {},
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}
