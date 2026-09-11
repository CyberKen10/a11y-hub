import { describe, expect, it } from "vitest";
import {
  inferCompanySeverity,
  normalizeApproachMetadata,
  normalizeBugType,
  normalizeCompanyStatus,
  normalizeCpValue,
  normalizePlatform,
} from "@/lib/approach-options";

describe("approach option normalizers", () => {
  it("maps wiki Bug Type aliases onto the selector", () => {
    expect(normalizeBugType("SR")).toBe("SR");
    expect(normalizeBugType("Screen Readers")).toBe("SR");
    expect(normalizeBugType("Keyboard Navigation")).toBe("KB");
    expect(normalizeBugType("Color Contrast")).toBe("CC");
    expect(normalizeBugType("Visual")).toBe("CC");
    expect(normalizeBugType("F73")).toBe("F73");
  });

  it("maps Platform aliases onto the selector", () => {
    expect(normalizePlatform("All")).toBe("Any");
    expect(normalizePlatform("HTML")).toBe("Web");
    expect(normalizePlatform("Android/iOS")).toBe("Android/iOS");
    expect(normalizePlatform("Web (inferido; ajustar si es app nativa)")).toBe(
      "Web"
    );
  });

  it("maps company columns onto wiki statuses", () => {
    expect(normalizeCompanyStatus("-")).toBe("N/A");
    expect(normalizeCompanyStatus("Valid Bug (inferido): algo")).toBe("Valid Bug");
    expect(normalizeCompanyStatus("Valid Bug (Low)")).toBe("Valid Bug (Low)");
    expect(normalizeCompanyStatus("Valid Bug (High)")).toBe("Valid Bug (High)");
    expect(normalizeCompanyStatus("critical")).toBe("Valid Bug (Critical)");
    expect(normalizeCompanyStatus("BP / UX")).toBe("BP / UX");
  });

  it("infers severity from Low to Critical", () => {
    expect(inferCompanySeverity("keyboard trap, no se puede salir")).toBe(
      "Valid Bug (Critical)"
    );
    expect(inferCompanySeverity("impacto alto, grave para el usuario")).toBe(
      "Valid Bug (High)"
    );
    expect(inferCompanySeverity("un issue típico de etiqueta")).toBe(
      "Valid Bug (Medium)"
    );
    expect(inferCompanySeverity("detalle menor, low impact")).toBe(
      "Valid Bug (Low)"
    );
  });

  it("keeps only SC ids in CP", () => {
    expect(normalizeCpValue("1.4.3 Contrast (Minimum), 4.1.2")).toBe(
      "1.4.3, 4.1.2"
    );
  });

  it("normalizes a whole ficha", () => {
    const meta = normalizeApproachMetadata({
      CP: "1.1.1 Non-text Content",
      "Bug Type": "Screen Readers",
      Platform: "All",
      Team: "-",
      UTest: "Valid Bug (Medium)",
      Crownspeak: "N/A",
      Barcelo: "Apply",
      "Pros.": "TBD",
    });
    expect(meta.CP).toBe("1.1.1");
    expect(meta["Bug Type"]).toBe("SR");
    expect(meta.Platform).toBe("Any");
    expect(meta.Team).toBe("N/A");
    expect(meta.UTest).toBe("Valid Bug (Medium)");
  });
});
