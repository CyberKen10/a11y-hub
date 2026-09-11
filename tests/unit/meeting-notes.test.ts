import { describe, expect, it } from "vitest";
import { transcriptToNotes } from "@/lib/transcript";
import { meetingExtractionSchema } from "@/lib/schemas";

describe("transcriptToNotes", () => {
  it("keeps plain meeting notes", () => {
    expect(transcriptToNotes("Acordamos no reportar el diálogo Android.")).toBe(
      "Acordamos no reportar el diálogo Android."
    );
  });

  it("strips VTT timestamps", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Acordamos usar el approach de 1.4.3.

00:00:05.000 --> 00:00:08.000
Y la metodología de auditoría semanal.`;
    const notes = transcriptToNotes(vtt);
    expect(notes).toContain("Acordamos usar el approach de 1.4.3.");
    expect(notes).toContain("metodología de auditoría semanal");
    expect(notes).not.toContain("-->");
    expect(notes).not.toContain("WEBVTT");
  });
});

describe("meetingExtractionSchema", () => {
  it("accepts an empty agreements list", () => {
    expect(meetingExtractionSchema.parse({ agreements: [] }).agreements).toEqual(
      []
    );
  });

  it("rejects more than 10 agreements", () => {
    const row = {
      decision: "Acuerdo",
      type_slug: "metodologias",
      title: "Auditoría semanal",
      summary: "Resumen",
      content: "Contenido",
      tags: ["audit"],
      metadata: {
        CP: "1.3.1",
        when_to_use: "x",
        pros: "x",
        cons: "x",
        "Bug Type": "Other A11y",
        Platform: "Any",
        Team: "N/A",
        UTest: "N/A",
        Crownspeak: "N/A",
        Barcelo: "N/A",
        "Pros.": "N/A",
        Comments: "x",
      },
      sources: [],
    };
    const result = meetingExtractionSchema.safeParse({
      agreements: Array.from({ length: 11 }, () => row),
    });
    expect(result.success).toBe(false);
  });
});
