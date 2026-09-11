"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authConfigError, isHtmlParseError } from "@/lib/supabase/config";

export type AuthState = { error?: string; message?: string };

function signInErrorMessage(error: { message: string; code?: string }): string {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();
  if (isHtmlParseError(error.message)) {
    return "Supabase no respondió bien: revisa NEXT_PUBLIC_SUPABASE_URL (debe ser https://xxxxx.supabase.co) y la anon/publishable key.";
  }
  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "La cuenta existe, pero el correo aún no está confirmado. En Supabase: Authentication → Users → tu usuario → Confirm user. En un hub interno también puedes desactivar Confirm email en Authentication → Providers → Email.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login")) {
    return "Correo o contraseña incorrectos.";
  }
  return error.message;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const configError = authConfigError();
  if (configError) {
    return { error: configError };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: signInErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
