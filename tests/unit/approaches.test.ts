import { describe, expect, it } from "vitest";
import {
  APPROACH_COMPOSER_FIELDS,
  APPROVAL_QUORUM,
  addHubApproval,
  fillBlankApproachMetadata,
  formatSourceFicha,
  getApprovalState,
  listApprovers,
  mergePreservedApproval,
  queryPrefersPending,
  withAllComposerMetadata,
} from "@/lib/approaches";

const fiveWiki = ["Yen", "Yudi", "Yise", "Diane", "Yune"];

describe("getApprovalState", () => {
  it("stays pending until more than 4 people have approved", () => {
    expect(getApprovalState({ wiki_reviewers: fiveWiki.slice(0, 4) })).toBe(
      "pending"
    );
    expect(getApprovalState({ wiki_reviewers: fiveWiki })).toBe("approved");
    expect(APPROVAL_QUORUM).toBe(5);
  });

  it("does not treat wiki Status=Approved as enough on its own", () => {
    expect(getApprovalState({ Status: "Approved" })).toBe("pending");
  });

  it("keeps discarded even if there are votes", () => {
    expect(
      getApprovalState({ Status: "Discarded", wiki_reviewers: fiveWiki })
    ).toBe("discarded");
  });

  it("counts hub votes together with wiki votes", () => {
    expect(
      getApprovalState({
        wiki_reviewers: ["Yen", "Yudi", "Yise", "Diane"],
        hub_approvals: [
          {
            approved_by_id: "u1",
            approved_by_name: "Kendry",
            approved_by_email: "k@x.com",
            approved_at: "2026-09-10T00:00:00.000Z",
          },
        ],
      })
    ).toBe("approved");
  });
});

describe("listApprovers", () => {
  it("shows who already approved and dedupes the same person", () => {
    const names = listApprovers({
      wiki_reviewers: ["Yen", "Kendry"],
      hub_approval: {
        approved_by_id: "u1",
        approved_by_name: "Kendry",
        approved_by_email: "k@x.com",
        approved_at: "2026-09-10T00:00:00.000Z",
      },
    }).map((a) => a.name);
    expect(names).toEqual(["Kendry", "Yen"]);
  });
});

describe("addHubApproval", () => {
  it("adds a vote without marking approved before the quorum", () => {
    const next = addHubApproval(
      { wiki_reviewers: ["Yen"] },
      {
        approved_by_id: "u1",
        approved_by_name: "Kendry",
        approved_by_email: "k@x.com",
        approved_at: "2026-09-10T00:00:00.000Z",
      }
    );
    expect(next.approval_state).toBe("pending");
    expect((next.hub_approvals as unknown[]).length).toBe(1);
  });
});

describe("mergePreservedApproval", () => {
  it("keeps hub votes when the wiki is re-imported", () => {
    const merged = mergePreservedApproval(
      { Status: "Under Review", Team: "Valid Bug", wiki_reviewers: ["Yen"] },
      {
        hub_approval: {
          approved_by_id: "u1",
          approved_by_name: "Kendry",
          approved_by_email: "k@x.com",
          approved_at: "2026-09-10T00:00:00.000Z",
        },
        approval_state: "approved",
      }
    );
    expect(merged.approval_state).toBe("pending");
    expect(merged.Team).toBe("Valid Bug");
    expect(
      (merged.hub_approvals as { approved_by_name: string }[])[0]?.approved_by_name
    ).toBe("Kendry");
  });
});

describe("formatSourceFicha", () => {
  it("includes approval count, names and company columns", () => {
    const text = formatSourceFicha({
      wiki_reviewers: ["Yen", "Yudi"],
      Team: "Valid Bug",
      UTest: "N/A",
      CP: "1.4.3 Contrast (Minimum)",
    });
    expect(text).toContain("SC WCAG: 1.4.3");
    expect(text).toContain("Estado: Sin aprobar (2 de 5)");
    expect(text).toContain("Ya aprobaron: Yen, Yudi");
    expect(text).toContain("Team: Valid Bug");
    expect(text).toContain("UTest: N/A");
  });
});

describe("queryPrefersPending", () => {
  it("detects questions about unapproved approaches", () => {
    expect(queryPrefersPending("approaches sin aprobar")).toBe(true);
    expect(queryPrefersPending("cómo se anuncia required")).toBe(false);
  });
});

describe("withAllComposerMetadata", () => {
  it("always includes SC WCAG and the rest of approach fields", () => {
    const meta = withAllComposerMetadata("approaches", { CP: "1.4.3", Team: "A11y" });
    expect(meta.CP).toBe("1.4.3");
    expect(meta.Team).toBe("A11y");
    expect(meta).toHaveProperty("when_to_use", "");
    expect(meta).toHaveProperty("Platform", "");
    expect(meta).toHaveProperty("Comments", "");
  });
});

describe("fillBlankApproachMetadata", () => {
  it("fills every approach field when the model left them empty", () => {
    const meta = fillBlankApproachMetadata(
      withAllComposerMetadata("approaches", {}),
      {
        title: "Contraste insuficiente en el botón primario",
        summary: "El texto blanco sobre verde no llega a 4.5:1.",
        content: "En Android el botón Guardar no cumple contraste.",
      }
    );
    for (const field of APPROACH_COMPOSER_FIELDS) {
      expect(meta[field.key]?.trim().length).toBeGreaterThan(0);
    }
    expect(meta.CP).toContain("1.4.3");
    expect(meta.Platform).toBe("Android");
    expect(meta["Bug Type"]).toBe("CC");
    expect(meta.Team).toBe("Valid Bug (Medium)");
  });

  it("does not overwrite fields the model already filled", () => {
    const meta = fillBlankApproachMetadata(
      withAllComposerMetadata("approaches", { CP: "2.4.4", Team: "N/A" }),
      { title: "Enlace sin propósito", summary: "", content: "" }
    );
    expect(meta.CP).toBe("2.4.4");
    expect(meta.Team).toBe("N/A");
    expect(meta.when_to_use.trim().length).toBeGreaterThan(0);
  });
});
