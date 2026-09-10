import { describe, expect, it } from "vitest";
import { knowledgeItemInputSchema, slugify } from "@/lib/schemas";

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

describe("slugify", () => {
  it("normalizes accents, spaces and case", () => {
    expect(slugify("Metodología Ágil ")).toBe("metodologia-agil");
  });

  it("strips symbols", () => {
    expect(slugify("WCAG 2.2 (AA)!")).toBe("wcag-2-2-aa");
  });
});
