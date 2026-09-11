import { generateSpeech } from "ai";
import { z } from "zod";
import { speechModel, ttsVoice } from "@/lib/ai";
import { publicAiError } from "@/lib/ai-errors";
import { consumeAiQuota } from "@/lib/ai-quota";
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

  const quota = await consumeAiQuota(user.id, "speech");
  if (!quota.ok) {
    return Response.json({ error: quota.message }, { status: 429 });
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
      model: speechModel(),
      text: speakable,
      voice: ttsVoice(),
      outputFormat: "mp3",
    });

    return new Response(Buffer.from(result.audio.uint8Array), {
      headers: {
        "Content-Type": result.audio.mediaType || "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[speech] failed", error);
    return Response.json(
      { error: publicAiError("speech", error) },
      { status: 500 }
    );
  }
}
