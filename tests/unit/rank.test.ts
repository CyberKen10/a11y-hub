import { describe, expect, it } from "vitest";
import { applyApprovalBoost, topDocumentsByScore } from "@/lib/rag/rank";

describe("topDocumentsByScore", () => {
  it("returns at most 3 distinct documents, highest score first", () => {
    const picked = topDocumentsByScore([
      { item_id: "a", score: 0.2, chunk: 1 },
      { item_id: "a", score: 0.9, chunk: 2 },
      { item_id: "b", score: 0.5, chunk: 1 },
      { item_id: "c", score: 0.4, chunk: 1 },
      { item_id: "d", score: 0.8, chunk: 1 },
    ]);
    expect(picked.map((r) => r.item_id)).toEqual(["a", "d", "b"]);
    expect(picked[0]?.chunk).toBe(2);
  });
});

describe("applyApprovalBoost", () => {
  it("prefers approved approaches by default", () => {
    const boosted = applyApprovalBoost(
      [
        { item_id: "pending", score: 0.5 },
        { item_id: "ok", score: 0.45 },
      ],
      new Map([
        ["pending", "pending"],
        ["ok", "approved"],
      ]),
      false
    );
    expect(boosted.find((r) => r.item_id === "ok")?.score).toBeGreaterThan(
      boosted.find((r) => r.item_id === "pending")?.score ?? 0
    );
  });
});
