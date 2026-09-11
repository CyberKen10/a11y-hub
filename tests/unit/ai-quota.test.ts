import { describe, expect, it } from "vitest";
import { aiQuotaDeniedMessage, aiQuotaLimit } from "@/lib/ai-quota-limits";

describe("aiQuotaDeniedMessage", () => {
  it("explains the per-person daily cap", () => {
    const text = aiQuotaDeniedMessage("chat", 20, 20);
    expect(text).toContain("20 preguntas de chat");
    expect(text).toContain("20/20");
    expect(text).toContain("medianoche UTC");
  });
});

describe("aiQuotaLimit", () => {
  it("uses built-in defaults", () => {
    expect(aiQuotaLimit("chat")).toBeGreaterThan(0);
    expect(aiQuotaLimit("extract")).toBeGreaterThan(0);
  });
});
