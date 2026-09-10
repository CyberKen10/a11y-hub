"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import type { UserRole } from "@/lib/types";

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile("admin");

  if (userId === profile.id) {
    return { ok: false, error: "No puedes cambiar tu propio rol." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "user.role_change",
    entity: "profiles",
    entityId: userId,
    detail: { role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
