"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Reads an assistant answer aloud (OpenAI TTS) with pause and speed control. */
export function TtsButton({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">(
    "idle"
  );
  const [rate, setRate] = useState(1);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function toggle() {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("paused");
      return;
    }
    if (status === "paused" && audioRef.current) {
      audioRef.current.playbackRate = rate;
      await audioRef.current.play();
      setStatus("playing");
      return;
    }

    setStatus("loading");
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? `No se pudo generar el audio (HTTP ${response.status}).`
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audio.onended = () => setStatus("idle");
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch (error) {
      setStatus("idle");
      toast.error(error instanceof Error ? error.message : "Error de audio.");
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        aria-label={
          status === "playing"
            ? "Pausar lectura"
            : status === "loading"
              ? "Generando audio…"
              : "Escuchar respuesta"
        }
      >
        {status === "loading" ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : status === "playing" ? (
          <Pause aria-hidden="true" />
        ) : (
          <Volume2 aria-hidden="true" />
        )}
        {status === "playing" ? "Pausar" : "Escuchar"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Velocidad de lectura: ${rate}x`}
          >
            {rate}x
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {RATES.map((r) => (
            <DropdownMenuItem
              key={r}
              onSelect={() => {
                setRate(r);
                if (audioRef.current) audioRef.current.playbackRate = r;
              }}
            >
              {r}x{r === rate ? " ✓" : ""}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
