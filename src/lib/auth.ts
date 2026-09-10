import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_RANK: Record<UserRole, number> = { reader: 0, editor: 1, admin: 2 };

/** Returns the signed-in user's profile or redirects to /login. */
export async function requireProfile(minRole: UserRole = "reader"): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  if (ROLE_RANK[profile.role] < ROLE_RANK[minRole]) {
    redirect("/?denied=1");
  }

  return profile;
}

export function canEdit(role: UserRole): boolean {
  return role === "editor" || role === "admin";
}
