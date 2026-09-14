import { describe, expect, it } from "vitest";
import {
  autoMapColumns,
  detectHeaderRow,
  inferTypeSlug,
  parseSpreadsheetId,
  shouldSkipTab,
} from "@/lib/import/auto-map";

describe("parseSpreadsheetId", () => {
  it("reads the id from a full Google Sheets URL", () => {
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/1AbCDefGhIJ-klmnopqrstuvwxYZ1234567/edit#gid=0"
      )
    ).toBe("1AbCDefGhIJ-klmnopqrstuvwxYZ1234567");
  });

  it("rejects a random sentence", () => {
    expect(parseSpreadsheetId("pega el link")).toBeNull();
  });
});

describe("inferTypeSlug", () => {
  it("maps tab names to apartados", () => {
    expect(inferTypeSlug("Metodologías 2024")).toBe("metodologias");
    expect(inferTypeSlug("Herramientas")).toBe("herramientas");
    expect(inferTypeSlug("Plantillas QA")).toBe("plantillas");
    expect(inferTypeSlug("Approaches")).toBe("approaches");
  });
});

describe("shouldSkipTab", () => {
  it("skips readme and hub mirror tabs", () => {
    expect(shouldSkipTab("LEEME")).toBe(true);
    expect(shouldSkipTab("Hub · Approaches")).toBe(true);
    expect(shouldSkipTab("Approaches")).toBe(false);
  });
});

describe("autoMapColumns", () => {
  it("finds title and content by header aliases", () => {
    const mapping = autoMapColumns(["Título", "Resumen", "Contenido", "Tags"]);
    expect(mapping.titleIdx).toBe(0);
    expect(mapping.summaryIdx).toBe(1);
    expect(mapping.contentIdx).toBe(2);
    expect(mapping.tagsIdx).toBe(3);
  });

  it("falls back to the first named column as title", () => {
    const mapping = autoMapColumns(["Ficha", "Notas"]);
    expect(mapping.titleIdx).toBe(0);
  });
});

describe("detectHeaderRow", () => {
  it("prefers the row with title-like headers", () => {
    const row = detectHeaderRow([
      { rowNumber: 1, values: ["Wiki Approaches", "", ""] },
      { rowNumber: 2, values: ["Título", "Contenido", "Tags"] },
    ]);
    expect(row).toBe(2);
  });
});
