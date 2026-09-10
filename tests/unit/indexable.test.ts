import { describe, expect, it } from "vitest";
import { buildIndexableText } from "@/lib/rag/indexable";
import type { KnowledgeFieldDef } from "@/lib/types";

const fields: KnowledgeFieldDef[] = [
  { key: "when_to_use", label: "Cuándo usarlo", kind: "textarea" },
  { key: "pros", label: "Ventajas", kind: "list" },
];

describe("buildIndexableText", () => {
  it("combines summary, content and metadata sections", () => {
    const text = buildIndexableText(
      {
        summary: "Resumen corto.",
        content: "# Título\nCuerpo del documento.",
        metadata: {
          when_to_use: "En fases tempranas.",
          pros: ["Barato", "Rápido"],
        },
      },
      fields
    );

    expect(text).toContain("Resumen corto.");
    expect(text).toContain("Cuerpo del documento.");
    expect(text).toContain("## Cuándo usarlo\nEn fases tempranas.");
    expect(text).toContain("## Ventajas\n- Barato\n- Rápido");
  });

  it("skips empty or missing metadata fields", () => {
    const text = buildIndexableText(
      { summary: null, content: "Solo cuerpo.", metadata: { pros: "" } },
      fields
    );
    expect(text).toBe("Solo cuerpo.");
  });

  it("indexes extra metadata keys not defined in the type (imported columns)", () => {
    const text = buildIndexableText(
      {
        summary: null,
        content: "Approach principal.",
        metadata: {
          CP: "4.1.2",
          Platform: "Android",
          "Aproach to be followed (Spanish)": "Solo un campo…",
        },
      },
      fields
    );
    expect(text).toContain("## CP\n4.1.2");
    expect(text).toContain("## Platform\nAndroid");
    expect(text).toContain("## Aproach to be followed (Spanish)\nSolo un campo…");
  });
});
