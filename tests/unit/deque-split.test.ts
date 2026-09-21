import { describe, expect, it } from "vitest";
import {
  itemsFromMarkdownDocs,
  parseCheckpointHeading,
} from "@/lib/import/deque-split";

describe("parseCheckpointHeading", () => {
  it("reads 1.4.3 a, 1.4.3.b and 1.3.1a as the same issue family", () => {
    expect(parseCheckpointHeading("1.4.3 a")).toEqual({
      scId: "1.4.3",
      variant: "a",
      heading: "",
    });
    expect(parseCheckpointHeading("1.4.3.b")).toEqual({
      scId: "1.4.3",
      variant: "b",
      heading: "",
    });
    expect(parseCheckpointHeading("1.3.1a")).toEqual({
      scId: "1.3.1",
      variant: "a",
      heading: "",
    });
    expect(parseCheckpointHeading("2.1.1.a Keyboard")).toEqual({
      scId: "2.1.1",
      variant: "a",
      heading: "Keyboard",
    });
    expect(parseCheckpointHeading("__1.4.4.a Resize (200%)__")).toEqual({
      scId: "1.4.4",
      variant: "a",
      heading: "Resize (200%)",
    });
  });

  it("ignores long sentences that mention an SC", () => {
    expect(
      parseCheckpointHeading(
        "Note: In WCAG 2.1, SC 1.4.11 Non-Text Contrast requires contrast of 3 to 1 for visual focus."
      )
    ).toBeNull();
  });
});

describe("itemsFromMarkdownDocs", () => {
  it("groups 1.3.1a and 1.3.1b into one ficha", () => {
    const items = itemsFromMarkdownDocs([
      {
        fileName: "SC other.docx",
        markdown: `1.3.1.a Headings

__Overview__

- Headings must be marked up.

1.3.1.b Tables

__Overview__

- Tables must have headers.
`,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("1.3.1 Info and Relationships");
    expect(items[0]?.metadata.CP).toBe("1.3.1");
    expect(items[0]?.metadata.variants).toBe("a, b");
    expect(items[0]?.content).toContain("## 1.3.1.a Headings");
    expect(items[0]?.content).toContain("## 1.3.1.b Tables");
    expect(items[0]?.content).toContain("### Overview");
    expect(items[0]?.source_sheet_tab).toBe("Deque · 1.3.1");
  });
});
