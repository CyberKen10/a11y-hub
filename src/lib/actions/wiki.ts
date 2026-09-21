"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { runPendingJobs } from "@/lib/sync/jobs";
import {
  autoMapColumns,
  detectHeaderRow,
  inferTypeSlug,
  shouldSkipTab,
} from "@/lib/import/auto-map";
import {
  toWikiSeedSummary,
  type ImportSummary,
  type WikiSeedSummary,
} from "@/lib/import/types";
import { mergeSummaries, upsertImportedRows } from "@/lib/import/upsert-rows";
import {
  seedApproachWiki,
  dedupePendingReindex,
  loadApproachWikiItemsFromBuffer,
  isWikiApproachesWorkbook,
} from "@/lib/import/seed-approaches-mod";

const MAX_EXCEL_BYTES = 20 * 1024 * 1024;

function sheetToRows(sheet: XLSX.WorkSheet): {
  rowNumber: number;
  values: string[];
}[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return matrix.map((row, i) => ({
    rowNumber: i + 1,
    values: (row ?? []).map((cell) => String(cell ?? "")),
  }));
}

async function importGenericWorkbook(args: {
  workbook: XLSX.WorkBook;
  fileName: string;
  ownerId: string;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<ImportSummary> {
  const parts: ImportSummary[] = [];
  for (const tab of args.workbook.SheetNames) {
    if (shouldSkipTab(tab)) continue;
    const sheet = args.workbook.Sheets[tab];
    if (!sheet) continue;
    const allRows = sheetToRows(sheet);
    if (allRows.length === 0) continue;
    const headerRowNumber = detectHeaderRow(allRows);
    const headerRowData = allRows.find((r) => r.rowNumber === headerRowNumber);
    if (!headerRowData) continue;
    const headers = headerRowData.values.map((h) => h.trim());
    const mapping = autoMapColumns(headers);
    const rows = allRows.filter((r) => r.rowNumber > headerRowNumber);
    parts.push(
      await upsertImportedRows({
        admin: args.admin,
        ownerId: args.ownerId,
        typeSlug: inferTypeSlug(tab),
        sourceTab: `Excel · ${args.fileName} · ${tab}`,
        headers,
        rows,
        mapping,
        publish: true,
      })
    );
  }
  return mergeSummaries(parts);
}

export async function importExcelUpload(
  formData: FormData
): Promise<{ ok: true; summary: WikiSeedSummary } | { ok: false; error: string }> {
  const profile = await requireProfile("admin");
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Selecciona un archivo Excel." };
  }
  if (file.size > MAX_EXCEL_BYTES) {
    return { ok: false, error: "El Excel supera el límite de 20 MB." };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return { ok: false, error: "Sube un archivo .xlsx o .xls." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();
    const parsed = loadApproachWikiItemsFromBuffer(buffer, file.name);
    const wikiLike =
      isWikiApproachesWorkbook(parsed.workbook) && parsed.items.length > 0;

    let summary: WikiSeedSummary;
    if (wikiLike) {
      const seeded = await seedApproachWiki(admin, {
        ownerId: profile.id,
        enqueueReindex: true,
        items: parsed.items,
      });
      await dedupePendingReindex(admin);
      summary = toWikiSeedSummary(seeded, file.name);
    } else {
      const generic = await importGenericWorkbook({
        workbook: parsed.workbook,
        fileName: file.name,
        ownerId: profile.id,
        admin,
      });
      summary = { ...generic, file: file.name, queued: generic.created + generic.updated };
    }

    await audit({
      actorId: profile.id,
      actorEmail: profile.email,
      action: "excel.import",
      entity: "knowledge_items",
      detail: { ...summary },
    });

    try {
      await runPendingJobs();
    } catch (error) {
      console.error("[excel-import] job batch failed", error);
    }

    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
