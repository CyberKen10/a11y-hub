"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSheetTabs, readTab } from "@/lib/google/sheets";
import { runPendingJobs, processJob } from "@/lib/sync/jobs";
import { audit } from "@/lib/audit";
import { isSheetsConfigured } from "@/lib/env";

export interface ImportMapping {
  /** Column header used as title (required). */
  title: string;
  summary?: string;
  content?: string;
  tags?: string;
}

export interface ImportConfig {
  tab: string;
  typeSlug: string;
  mapping: ImportMapping;
  publish: boolean;
  /** 1-based row that contains the column headers (default 1). */
  headerRow: number;
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function fetchTabs(): Promise<
  { ok: true; tabs: string[] } | { ok: false; error: string }
> {
  await requireProfile("admin");
  if (!isSheetsConfigured()) {
    return {
      ok: false,
      error:
        "Google Sheets no está configurado. Define GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY y GOOGLE_SHEET_ID.",
    };
  }
  try {
    const tabs = await listSheetTabs();
    return { ok: true, tabs };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function previewTab(tab: string): Promise<
  | {
      ok: true;
      /** First raw rows so the admin can pick the header row. */
      sampleRows: { rowNumber: number; values: string[] }[];
      totalRows: number;
    }
  | { ok: false; error: string }
> {
  await requireProfile("admin");
  try {
    const { rows } = await readTab(tab);
    return {
      ok: true,
      sampleRows: rows.slice(0, 8),
      totalRows: rows.length,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checksumOf(values: string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

/**
 * Idempotent import: each source row is identified by (tab, row number).
 * Rows whose checksum has not changed are skipped; changed rows update the
 * existing item. Unmapped columns are preserved in `metadata`.
 */
export async function runImport(
  config: ImportConfig
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const profile = await requireProfile("admin");
  const admin = createAdminClient();

  const { data: type } = await admin
    .from("knowledge_types")
    .select("id, name")
    .eq("slug", config.typeSlug)
    .single();
  if (!type) return { ok: false, error: "Apartado de destino desconocido." };

  let allRows: { rowNumber: number; values: string[] }[];
  try {
    ({ rows: allRows } = await readTab(config.tab));
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const headerRowNumber = Math.max(1, config.headerRow || 1);
  const headerRowData = allRows.find((r) => r.rowNumber === headerRowNumber);
  if (!headerRowData) {
    return { ok: false, error: "La fila de encabezados indicada no existe." };
  }
  const headers = headerRowData.values.map((h) => h.trim());
  // Data starts after the header row; banner rows above it are ignored.
  const rows = allRows.filter((r) => r.rowNumber > headerRowNumber);

  const colIndex = (name?: string) =>
    name ? headers.findIndex((h) => h === name) : -1;
  const titleIdx = colIndex(config.mapping.title);
  if (titleIdx < 0) {
    return { ok: false, error: "La columna de título no existe en la pestaña." };
  }
  const summaryIdx = colIndex(config.mapping.summary);
  const contentIdx = colIndex(config.mapping.content);
  const tagsIdx = colIndex(config.mapping.tags);
  const mappedIdx = new Set(
    [titleIdx, summaryIdx, contentIdx, tagsIdx].filter((i) => i >= 0)
  );

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const title = (row.values[titleIdx] ?? "").trim();
    if (!title) {
      summary.skipped++;
      continue;
    }

    const checksum = checksumOf(row.values);

    const { data: existing } = await admin
      .from("knowledge_items")
      .select("id, source_checksum")
      .eq("source_sheet_tab", config.tab)
      .eq("source_sheet_row", row.rowNumber)
      .maybeSingle();

    if (existing && existing.source_checksum === checksum) {
      summary.skipped++;
      continue;
    }

    // Unmapped columns are preserved as metadata (same info as the sheet).
    const metadata: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!mappedIdx.has(i) && h && (row.values[i] ?? "").trim()) {
        metadata[h] = row.values[i].trim();
      }
    });

    let content = contentIdx >= 0 ? (row.values[contentIdx] ?? "").trim() : "";
    if (!content) {
      content = Object.entries(metadata)
        .map(([k, v]) => `**${k}:** ${v}`)
        .join("\n\n");
    }
    if (!content) content = title;

    const fields = {
      type_id: type.id,
      title,
      summary: summaryIdx >= 0 ? (row.values[summaryIdx] ?? "").trim() || null : null,
      content,
      metadata,
      status: config.publish ? ("published" as const) : ("draft" as const),
      source_sheet_tab: config.tab,
      source_sheet_row: row.rowNumber,
      source_checksum: checksum,
    };

    try {
      let itemId: string;
      if (existing) {
        const { error } = await admin
          .from("knowledge_items")
          .update(fields)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        itemId = existing.id;
        summary.updated++;
      } else {
        const { data: created, error } = await admin
          .from("knowledge_items")
          .insert({ ...fields, owner_id: profile.id })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "insert falló");
        itemId = created.id;
        summary.created++;
      }

      // Tags column → tag rows.
      if (tagsIdx >= 0) {
        const names = (row.values[tagsIdx] ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        for (const name of names) {
          const slug = name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
          if (!slug) continue;
          const { data: tag } = await admin
            .from("tags")
            .upsert({ name, slug }, { onConflict: "slug" })
            .select("id")
            .single();
          if (tag) {
            await admin
              .from("item_tags")
              .upsert({ item_id: itemId, tag_id: tag.id });
          }
        }
      }

      // Queue indexing (and mirror) as pending jobs; they are processed in
      // batches from the sync panel to keep the import fast and resumable.
      await admin.from("sync_jobs").insert([
        { kind: "reindex", item_id: itemId },
        { kind: "sheet_mirror", item_id: itemId },
      ]);
    } catch (error) {
      summary.errors.push(
        `Fila ${row.rowNumber}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "sheets.import",
    entity: "knowledge_items",
    detail: { tab: config.tab, type: config.typeSlug, ...summary },
  });

  // Kick off a first batch of jobs right away (best effort).
  try {
    await runPendingJobs();
  } catch (error) {
    console.error("[import] job batch failed", error);
  }

  revalidatePath("/", "layout");
  return { ok: true, summary };
}

/** Retries a single failed job from the sync panel. */
export async function retryJob(jobId: string) {
  await requireProfile("admin");
  const status = await processJob(jobId);
  revalidatePath("/admin/sync");
  return { status };
}

/** Processes the next batch of pending/failed jobs. */
export async function processPendingJobs() {
  await requireProfile("admin");
  const result = await runPendingJobs();
  revalidatePath("/admin/sync");
  return result;
}
