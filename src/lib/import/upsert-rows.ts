import "server-only";
import { createHash } from "node:crypto";
import { slugify } from "@/lib/schemas";
import { isActiveTypeSlug } from "@/lib/knowledge-sections";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ImportSummary } from "@/lib/import/types";

function checksumOf(values: string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

export async function upsertImportedRows(args: {
  admin: ReturnType<typeof createAdminClient>;
  ownerId: string;
  typeSlug: string;
  sourceTab: string;
  headers: string[];
  rows: { rowNumber: number; values: string[] }[];
  mapping: {
    titleIdx: number;
    summaryIdx: number;
    contentIdx: number;
    tagsIdx: number;
  };
  publish: boolean;
}): Promise<ImportSummary> {
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (!isActiveTypeSlug(args.typeSlug)) {
    summary.errors.push(`Apartado no disponible: ${args.typeSlug}`);
    return summary;
  }
  if (args.mapping.titleIdx < 0) {
    summary.errors.push(`Sin columna de título en «${args.sourceTab}».`);
    return summary;
  }

  const { data: type } = await args.admin
    .from("knowledge_types")
    .select("id")
    .eq("slug", args.typeSlug)
    .single();
  if (!type) {
    summary.errors.push(`Apartado desconocido: ${args.typeSlug}`);
    return summary;
  }

  const mappedIdx = new Set(
    [
      args.mapping.titleIdx,
      args.mapping.summaryIdx,
      args.mapping.contentIdx,
      args.mapping.tagsIdx,
    ].filter((i) => i >= 0)
  );

  for (const row of args.rows) {
    const title = (row.values[args.mapping.titleIdx] ?? "").trim();
    if (!title) {
      summary.skipped++;
      continue;
    }

    const checksum = checksumOf(row.values);
    const { data: existing } = await args.admin
      .from("knowledge_items")
      .select("id, source_checksum")
      .eq("source_sheet_tab", args.sourceTab)
      .eq("source_sheet_row", row.rowNumber)
      .maybeSingle();

    if (existing && existing.source_checksum === checksum) {
      summary.skipped++;
      continue;
    }

    const metadata: Record<string, string> = {};
    args.headers.forEach((h, i) => {
      if (!mappedIdx.has(i) && h && (row.values[i] ?? "").trim()) {
        metadata[h] = row.values[i].trim();
      }
    });

    let content =
      args.mapping.contentIdx >= 0
        ? (row.values[args.mapping.contentIdx] ?? "").trim()
        : "";
    if (!content) {
      content = Object.entries(metadata)
        .map(([k, v]) => `**${k}:** ${v}`)
        .join("\n\n");
    }
    if (!content) content = title;

    const fields = {
      type_id: type.id,
      title,
      summary:
        args.mapping.summaryIdx >= 0
          ? (row.values[args.mapping.summaryIdx] ?? "").trim() || null
          : null,
      content,
      metadata,
      status: args.publish ? ("published" as const) : ("draft" as const),
      source_sheet_tab: args.sourceTab,
      source_sheet_row: row.rowNumber,
      source_checksum: checksum,
    };

    try {
      let itemId: string;
      if (existing) {
        const { error } = await args.admin
          .from("knowledge_items")
          .update(fields)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        itemId = existing.id;
        summary.updated++;
      } else {
        const { data: created, error } = await args.admin
          .from("knowledge_items")
          .insert({ ...fields, owner_id: args.ownerId })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "insert falló");
        itemId = created.id;
        summary.created++;
      }

      if (args.mapping.tagsIdx >= 0) {
        const names = (row.values[args.mapping.tagsIdx] ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        for (const name of names) {
          const slug = slugify(name);
          if (!slug) continue;
          const { data: tag } = await args.admin
            .from("tags")
            .upsert({ name, slug }, { onConflict: "slug" })
            .select("id")
            .single();
          if (tag) {
            await args.admin
              .from("item_tags")
              .upsert({ item_id: itemId, tag_id: tag.id });
          }
        }
      }

      await args.admin.from("sync_jobs").insert({ kind: "reindex", item_id: itemId });
    } catch (error) {
      summary.errors.push(
        `«${args.sourceTab}» fila ${row.rowNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return summary;
}

export function mergeSummaries(parts: ImportSummary[]): ImportSummary {
  return parts.reduce(
    (acc, part) => ({
      created: acc.created + part.created,
      updated: acc.updated + part.updated,
      skipped: acc.skipped + part.skipped,
      errors: [...acc.errors, ...part.errors],
    }),
    { created: 0, updated: 0, skipped: 0, errors: [] }
  );
}
