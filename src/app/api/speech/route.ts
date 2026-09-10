import { generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
});

/** Text-to-speech: returns MP3 audio for an assistant answer. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Texto inválido." }, { status: 400 });
  }

  // Strip Markdown noise and citation markers for a natural read-aloud.
  const speakable = parsed.data.text
    .replace(/\[\d+\]/g, "")
    .replace(/[#*_`>|-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 4000);

  try {
    const result = await generateSpeech({
      model: openai.speech(env.ttsModel),
      text: speakable,
      voice: "nova",
      outputFormat: "mp3",
    });

    return new Response(Buffer.from(result.audio.uint8Array), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[speech] failed", error);
    return Response.json(
      { error: "No se pudo generar el audio." },
      { status: 500 }
    );
  }
}
