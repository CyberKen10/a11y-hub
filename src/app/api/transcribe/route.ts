import { transcribe } from "ai";
import { openai } from "@ai-sdk/openai";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB

/** Speech-to-text: receives recorded audio, returns the transcription. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ error: "Falta el audio." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "El audio supera el límite de 20 MB." },
      { status: 400 }
    );
  }

  try {
    const result = await transcribe({
      model: openai.transcription(env.transcribeModel),
      audio: new Uint8Array(await audio.arrayBuffer()),
    });
    return Response.json({ text: result.text });
  } catch (error) {
    console.error("[transcribe] failed", error);
    return Response.json(
      { error: "No se pudo transcribir el audio." },
      { status: 500 }
    );
  }
}
