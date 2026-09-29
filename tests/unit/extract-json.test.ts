import { describe, expect, it } from "vitest";
import { parseExtractedItems, parseJsonValue } from "@/lib/extract-json";

describe("parseJsonValue", () => {
  it("reads a fenced JSON object", () => {
    const value = parseJsonValue('Sure.\n```json\n{"items":[]}\n```\n');
    expect(value).toEqual({ items: [] });
  });

  it("reads JSON with surrounding commentary", () => {
    const value = parseJsonValue('Aquí va:\n{"items":[{"title":"x"}]}\nlisto');
    expect(value).toEqual({ items: [{ title: "x" }] });
  });
});

describe("parseExtractedItems", () => {
  it("accepts a metodologias ficha without full approach metadata", () => {
    const items = parseExtractedItems(
      JSON.stringify({
        items: [
          {
            decision: "Auditoría semanal",
            type_slug: "metodologias",
            title: "Auditoría semanal",
            summary: "Ritual del equipo",
            content: "## Pasos\n1. Revisar cola.",
            tags: ["auditoria"],
            metadata: {},
            sources: [],
          },
        ],
      })
    );
    expect(items).toHaveLength(1);
    expect(items[0].type_slug).toBe("metodologias");
    expect(items[0].title).toBe("Auditoría semanal");
  });

  it("rejects more than 10 items", () => {
    const row = {
      decision: "Tema",
      type_slug: "metodologias",
      title: "Auditoría semanal",
      summary: "Resumen",
      content: "Contenido",
      tags: ["audit"],
      metadata: {},
      sources: [],
    };
    expect(() =>
      parseExtractedItems(JSON.stringify({ items: Array.from({ length: 11 }, () => row) }))
    ).toThrow(/schema/);
  });
});
