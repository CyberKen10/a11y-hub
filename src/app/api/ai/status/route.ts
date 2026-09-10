import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAiDiagnostics } from "@/lib/ai/diagnostics";
import { publicAiError } from "@/lib/ai-errors";

export const maxDuration = 60;

/** Isolated AI checks so testers can see which layer fails. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: publicAiError("auth", "No hay sesión.") },
      { status: 401 }
    );
  }

  try {
    const result = await runAiDiagnostics();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: publicAiError("config", error) },
      { status: 500 }
    );
  }
}
