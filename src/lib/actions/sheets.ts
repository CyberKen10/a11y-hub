"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSheetTabs, readTab, isGoogleAuthConfigured } from "@/lib/google/sheets";
import { runPendingJobs, processJob } from "@/lib/sync/jobs";
import { audit } from "@/lib/audit";
import {
  autoMapColumns,
  detectHeaderRow,
  inferTypeSlug,
  parseSpreadsheetId,
  shouldSkipTab,
} from "@/lib/import/auto-map";
import {
  mergeSummaries,
  upsertImportedRows,
  type ImportSummary,
} from "@/lib/import/upsert-rows";

export type { ImportSummary };

export async function importFromSheetUrl(
  url: string
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const profile = await requireProfile("admin");
  if (!isGoogleAuthConfigured()) {
    return {
      ok: false,
      error:
        "Falta la cuenta de servicio de Google. Define GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY, y comparte el Sheet con ese correo (Lector).",
    };
  }

  const spreadsheetId = parseSpreadsheetId(url);
  if (!spreadsheetId) {
    return { ok: false, error: "Pega el enlace completo del Google Sheet." };
  }

  let tabs: string[];
  try {
    tabs = await listSheetTabs(spreadsheetId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const usable = tabs.filter((tab) => !shouldSkipTab(tab));
  if (usable.length === 0) {
    return { ok: false, error: "Ese Sheet no tiene pestañas para importar." };
  }

  const admin = createAdminClient();
  const parts: ImportSummary[] = [];

  for (const tab of usable) {
    let allRows: { rowNumber: number; values: string[] }[];
    try {
      ({ rows: allRows } = await readTab(spreadsheetId, tab));
    } catch (error) {
      parts.push({
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [
          `Pestaña «${tab}»: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
      continue;
    }
    if (allRows.length === 0) continue;

    const headerRowNumber = detectHeaderRow(allRows);
    const headerRowData = allRows.find((r) => r.rowNumber === headerRowNumber);
    if (!headerRowData) continue;
    const headers = headerRowData.values.map((h) => h.trim());
    const mapping = autoMapColumns(headers);
    if (mapping.titleIdx < 0) {
      parts.push({
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [`Pestaña «${tab}»: no encontré una columna de título.`],
      });
      continue;
    }
    const rows = allRows.filter((r) => r.rowNumber > headerRowNumber);
    parts.push(
      await upsertImportedRows({
        admin,
        ownerId: profile.id,
        typeSlug: inferTypeSlug(tab),
        sourceTab: `${spreadsheetId} · ${tab}`,
        headers,
        rows,
        mapping,
        publish: true,
      })
    );
  }

  const summary = mergeSummaries(parts);
  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "sheets.import",
    entity: "knowledge_items",
    detail: { spreadsheetId, tabs: usable, ...summary },
  });

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
