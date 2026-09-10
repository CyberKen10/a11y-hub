import { describe, expect, it } from "vitest";
import { chunkMarkdown, estimateTokens } from "@/lib/rag/chunking";

describe("estimateTokens", () => {
  it("approximates 4 characters per token", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("chunkMarkdown", () => {
  it("returns empty array for empty input", () => {
    expect(chunkMarkdown("")).toEqual([]);
  });

  it("splits at headings and keeps the heading as context", () => {
    const md = [
      "Intro del documento con contexto suficiente para no ser fusionado con nada porque es el primer chunk del documento.",
      "",
      "## Cuándo usarlo",
      "Se usa en proyectos con plazos cortos y equipos pequeños. ".repeat(4),
      "",
      "## Limitaciones",
      "No cubre auditorías completas de conformidad ni certificaciones. ".repeat(4),
    ].join("\n");

    const chunks = chunkMarkdown(md);

    expect(chunks.length).toBe(3);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[1].heading).toBe("Cuándo usarlo");
    expect(chunks[2].heading).toBe("Limitaciones");
    expect(chunks[1].content).toContain("plazos cortos");
  });

  it("merges tiny fragments into the previous chunk", () => {
    const md = [
      "Contenido inicial suficientemente largo para constituir un chunk propio dentro del documento de prueba.",
      "",
      "## Nota",
      "Ok.",
    ].join("\n");

    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("Ok.");
  });

  it("splits oversized sections under the token budget", () => {
    const paragraph = "Esta es una frase de prueba razonablemente larga. ";
    const md = `## Sección grande\n${paragraph.repeat(200)}`;

    const chunks = chunkMarkdown(md, { maxTokens: 200 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.heading).toBe("Sección grande");
      expect(chunk.tokenCount).toBeLessThanOrEqual(320);
    }
  });
});
