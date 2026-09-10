import { generateText, transcribe } from "ai";
import { aiProvider, chatModel, openaiTranscriptionModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Speech-to-text.
 * - OpenAI: dedicated transcription model (gpt-4o-transcribe).
 * - Google (capa gratuita): Gemini acepta audio como entrada del modelo de
 *   chat, así que la transcripción va por generateText sin costo extra.
 */
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

  const audioBytes = new Uint8Array(await audio.arrayBuffer());

  try {
    if (aiProvider === "google") {
      const result = await generateText({
        model: chatModel(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe fielmente este audio. Devuelve SOLO la transcripción, sin comentarios ni formato. Corrige puntuación pero no cambies el contenido. Mantén el idioma original del hablante.",
              },
              {
                type: "file",
                mediaType: audio.type || "audio/webm",
                data: audioBytes,
              },
            ],
          },
        ],
      });
      return Response.json({ text: result.text.trim() });
    }

    const result = await transcribe({
      model: openaiTranscriptionModel(),
      audio: audioBytes,
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
