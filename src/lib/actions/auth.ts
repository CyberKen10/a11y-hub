"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { authConfigError, isHtmlParseError } from "@/lib/supabase/config";

export type AuthState = { error?: string; message?: string };

function domainAllowed(email: string): boolean {
  if (env.allowedEmailDomains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return env.allowedEmailDomains.includes(domain);
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
    if (isHtmlParseError(error.message)) {
      return {
        error:
          "Supabase no respondió bien: revisa NEXT_PUBLIC_SUPABASE_URL (debe ser https://xxxxx.supabase.co) y la anon/publishable key.",
      };
    }
    return { error: "Credenciales inválidas o cuenta inexistente." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const configError = authConfigError();
  if (configError) {
    return { error: configError };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!domainAllowed(email)) {
    return {
      error: "Solo se permiten cuentas del dominio corporativo autorizado.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    if (isHtmlParseError(error.message)) {
      return {
        error:
          "Supabase no respondió bien: revisa NEXT_PUBLIC_SUPABASE_URL (debe ser https://xxxxx.supabase.co) y la anon/publishable key. En Render hay que cambiar las env vars y redeploy.",
      };
    }
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }

  return {
    message:
      "Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
