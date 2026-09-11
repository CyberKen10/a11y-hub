import { describe, expect, it } from "vitest";
import {
  approachComposerMetadataSchema,
  knowledgeItemInputSchema,
  slugify,
} from "@/lib/schemas";

describe("knowledgeItemInputSchema", () => {
  const base = {
    type_slug: "approaches",
    title: "Shift-left accessibility",
    content: "Contenido del approach.",
  };

  it("accepts a minimal valid item and applies defaults", () => {
    const parsed = knowledgeItemInputSchema.parse(base);
    expect(parsed.status).toBe("draft");
    expect(parsed.tags).toEqual([]);
    expect(parsed.sources).toEqual([]);
    expect(parsed.metadata).toEqual({});
  });

  it("rejects a too-short title", () => {
    const result = knowledgeItemInputSchema.safeParse({ ...base, title: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = knowledgeItemInputSchema.safeParse({ ...base, content: "" });
    expect(result.success).toBe(false);
  });

  it("normalizes empty source URLs to null and rejects invalid ones", () => {
    const ok = knowledgeItemInputSchema.parse({
      ...base,
      sources: [{ label: "WCAG 2.2", url: "" }],
    });
    expect(ok.sources[0].url).toBeNull();

    const bad = knowledgeItemInputSchema.safeParse({
      ...base,
      sources: [{ label: "Rota", url: "no-es-url" }],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const result = knowledgeItemInputSchema.safeParse({
      ...base,
      status: "pendiente",
    });
    expect(result.success).toBe(false);
  });
});

describe("approachComposerMetadataSchema", () => {
  it("requires every approach ficha key", () => {
    const result = approachComposerMetadataSchema.safeParse({ CP: "1.4.3" });
    expect(result.success).toBe(false);

    const ok = approachComposerMetadataSchema.parse({
      CP: "1.4.3",
      when_to_use: "En botones de bajo contraste.",
      pros: "Reporte alineado a WCAG",
      cons: "Validar en el producto",
      "Bug Type": "SR",
      Platform: "Web",
      Team: "Valid Bug",
      UTest: "N/A",
      Crownspeak: "Valid Bug",
      Barcelo: "N/A",
      "Pros.": "Valid Bug",
      Comments: "Inferido salvo el contraste dictado.",
    });
    expect(ok.CP).toBe("1.4.3");
  });
});

describe("slugify", () => {
  it("normalizes accents, spaces and case", () => {
    expect(slugify("Metodología Ágil ")).toBe("metodologia-agil");
  });

  it("strips symbols", () => {
    expect(slugify("WCAG 2.2 (AA)!")).toBe("wcag-2-2-aa");
  });
});
