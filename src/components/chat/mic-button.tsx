"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useRecorder } from "@/hooks/use-recorder";
import { Button } from "@/components/ui/button";

/**
 * Records audio and returns the transcription via onTranscript.
 * Turn-based STT (gpt-4o-transcribe) — accessible controls, visible state.
 */
export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const { state, start, stop } = useRecorder();

  async function toggle() {
    if (state === "recording") {
      try {
        const blob = await stop();
        const formData = new FormData();
        formData.set("audio", new File([blob], "grabacion.webm", { type: blob.type }));
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || !data.text) {
          throw new Error(data.error ?? "Transcripción fallida.");
        }
        onTranscript(data.text);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al transcribir.");
      }
      return;
    }
    try {
      await start();
    } catch {
      toast.error("No se pudo acceder al micrófono. Revisa los permisos.");
    }
  }

  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "outline"}
      size="icon"
      disabled={disabled || state === "processing"}
      aria-label={
        state === "recording"
          ? "Detener grabación y transcribir"
          : state === "processing"
            ? "Transcribiendo…"
            : "Dictar por voz"
      }
      aria-pressed={state === "recording"}
      onClick={toggle}
    >
      {state === "recording" ? (
        <Square aria-hidden="true" />
      ) : state === "processing" ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Mic aria-hidden="true" />
      )}
    </Button>
  );
}
