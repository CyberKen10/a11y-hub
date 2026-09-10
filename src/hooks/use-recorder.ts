"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "processing";

/**
 * Minimal MediaRecorder hook: start(), stop() → Blob (webm/ogg audio).
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setState("recording");
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        reject(new Error("No hay grabación activa."));
        return;
      }
      setState("processing");
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        recorderRef.current = null;
        setState("idle");
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
      recorderRef.current = null;
    }
    setState("idle");
  }, []);

  return { state, start, stop, cancel };
}
