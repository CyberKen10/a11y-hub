"use server";

import { headers } from "next/headers";
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
    return "Correo o contraseña incorrectos. Si acabas de registrarte, confirma el usuario en el panel de Supabase.";
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
  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
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

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    message:
      "Cuenta creada, pero Supabase espera confirmar el correo y ese mail a menudo no llega en el plan gratuito. Entra a Authentication → Users, abre tu usuario y pulsa Confirm user. Luego inicia sesión. Para un hub interno: Authentication → Providers → Email → desactiva Confirm email.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
