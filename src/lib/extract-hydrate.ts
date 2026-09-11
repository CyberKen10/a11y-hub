import {
  fillBlankApproachMetadata,
  withAllComposerMetadata,
} from "@/lib/approaches";
import { parseWcagSuccessCriteria } from "@/lib/wcag";
import type { ExtractionResult } from "@/lib/schemas";
import type { KnowledgeFieldDef } from "@/lib/types";

export function hydrateExtractedItem(
  object: Pick<
    ExtractionResult,
    "type_slug" | "title" | "summary" | "content" | "tags" | "sources" | "metadata"
  >,
  typeFields?: KnowledgeFieldDef[] | null
): ExtractionResult {
  let metadata = withAllComposerMetadata(
    object.type_slug,
    object.metadata,
    typeFields
  );
  if (object.type_slug === "approaches") {
    metadata = fillBlankApproachMetadata(metadata, {
      title: object.title,
      summary: object.summary,
      content: object.content,
    });
  }
  const scs = parseWcagSuccessCriteria(metadata.CP);
  if (scs.length > 0) {
    metadata.wcag_refs = scs.join(", ");
  }
  return {
    type_slug: object.type_slug,
    title: object.title,
    summary: object.summary,
    content: object.content,
    tags: object.tags ?? [],
    metadata,
    sources: object.sources ?? [],
  };
}
