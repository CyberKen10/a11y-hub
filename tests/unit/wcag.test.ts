import { describe, expect, it } from "vitest";
import {
  collectWcagFilterOptions,
  compareWcagSc,
  formatWcagLine,
  getItemWcagSuccessCriteria,
  isWcagScId,
  parseWcagSuccessCriteria,
  wcagScFilterClause,
} from "@/lib/wcag";

describe("parseWcagSuccessCriteria", () => {
  it("extracts one or more SC ids from a CP cell", () => {
    expect(parseWcagSuccessCriteria("1.1.1")).toEqual(["1.1.1"]);
    expect(parseWcagSuccessCriteria("1.4.3 Contrast (Minimum)")).toEqual([
      "1.4.3",
    ]);
    expect(parseWcagSuccessCriteria("1.1.1 / 1.3.1, 2.4.4")).toEqual([
      "1.1.1",
      "1.3.1",
      "2.4.4",
    ]);
  });

  it("reads list fields and ignores empty values", () => {
    expect(parseWcagSuccessCriteria(["1.4.3", "N/A", "2.4.7"])).toEqual([
      "1.4.3",
      "2.4.7",
    ]);
    expect(parseWcagSuccessCriteria("")).toEqual([]);
    expect(parseWcagSuccessCriteria(null)).toEqual([]);
  });
});

describe("getItemWcagSuccessCriteria", () => {
  it("merges CP, wcag_refs and wcag_scs without duplicates", () => {
    expect(
      getItemWcagSuccessCriteria({
        CP: "4.1.2 Name, Role, Value",
        wcag_refs: ["1.3.1", "4.1.2"],
        wcag_scs: ["2.4.6"],
      })
    ).toEqual(["1.3.1", "2.4.6", "4.1.2"]);
  });
});

describe("collectWcagFilterOptions", () => {
  it("sorts unique SCs numerically", () => {
    expect(
      collectWcagFilterOptions([
        { metadata: { CP: "2.4.3" } },
        { metadata: { CP: "1.4.13" } },
        { metadata: { CP: "1.1.1, 2.4.3" } },
      ])
    ).toEqual(["1.1.1", "1.4.13", "2.4.3"]);
  });
});

describe("wcag helpers", () => {
  it("validates SC ids and builds a PostgREST filter", () => {
    expect(isWcagScId("1.4.3")).toBe(true);
    expect(isWcagScId("contrast")).toBe(false);
    expect(compareWcagSc("1.4.13", "1.4.3")).toBeGreaterThan(0);
    expect(wcagScFilterClause("1.4.3")).toContain(
      'metadata->>CP.match."(^|[^0-9])1\\.4\\.3([^0-9]|$)"'
    );
    expect(wcagScFilterClause("nope")).toBeNull();
  });

  it("formats the chat/ficha line", () => {
    expect(formatWcagLine({ CP: "1.1.1 Non-text Content" })).toBe(
      "SC WCAG: 1.1.1"
    );
    expect(formatWcagLine({})).toBe("");
  });
});
