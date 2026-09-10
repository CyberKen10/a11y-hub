import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertMirrorRow } from "@/lib/google/sheets";
import { reindexItem } from "@/lib/rag/indexer";
import { isSheetsConfigured } from "@/lib/env";

const MAX_ATTEMPTS = 5;

type JobKind = "sheet_mirror" | "reindex";

/** Creates a job and immediately tries to run it. Failures stay queued. */
export async function enqueueAndRun(
  kind: JobKind,
  itemId: string
): Promise<{ jobId: string; status: string }> {
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("sync_jobs")
    .insert({ kind, item_id: itemId })
    .select("id")
    .single();

  if (error || !job) {
    throw new Error(`No se pudo crear el job de sincronización: ${error?.message}`);
  }

  const status = await processJob(job.id);
  return { jobId: job.id, status };
}

/** Runs a single job; records the outcome and returns the final status. */
export async function processJob(jobId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("sync_jobs")
    .select("id, kind, item_id, attempts, status")
    .eq("id", jobId)
    .single();

  if (!job) return "missing";
  if (job.status === "done") return "done";
  if (job.attempts >= MAX_ATTEMPTS) return "failed";

  await admin
    .from("sync_jobs")
    .update({ status: "running", attempts: job.attempts + 1 })
    .eq("id", jobId);

  try {
    if (job.kind === "reindex") {
      await reindexItem(job.item_id!);
    } else if (job.kind === "sheet_mirror") {
      await mirrorItemToSheet(job.item_id!);
    }

    await admin
      .from("sync_jobs")
      .update({ status: "done", last_error: null })
      .eq("id", jobId);
    return "done";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("sync_jobs")
      .update({ status: "failed", last_error: message })
      .eq("id", jobId);
    return "failed";
  }
}

/** Retries every pending/failed job (admin panel + dashboard action). */
export async function runPendingJobs(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("sync_jobs")
    .select("id")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(25);

  for (const job of jobs ?? []) {
    await processJob(job.id);
  }
  return { processed: jobs?.length ?? 0 };
}

/** Writes the item's mirror row into the spreadsheet and stores its position. */
async function mirrorItemToSheet(itemId: string): Promise<void> {
  if (!isSheetsConfigured()) {
    throw new Error("Google Sheets no está configurado; el espejo queda pendiente.");
  }

  const admin = createAdminClient();
  const { data: item, error } = await admin
    .from("knowledge_items")
    .select(
      "id, title, summary, content, status, updated_at, mirror_tab, mirror_row, knowledge_types(name), item_tags(tags(name))"
    )
    .eq("id", itemId)
    .single();

  if (error || !item) {
    throw new Error(`Elemento ${itemId} no encontrado para espejar.`);
  }

  const typeName =
    (item.knowledge_types as unknown as { name: string } | null)?.name ??
    "Sin tipo";
  const tags = ((item.item_tags as unknown as { tags: { name: string } }[]) ?? [])
    .map((t) => t.tags?.name)
    .filter(Boolean)
    .join(", ");

  // The app maintains its own "Hub · <tipo>" tabs and never rewrites the
  // team's original tabs (those are only read during import).
  const tab = item.mirror_tab ?? `Hub · ${typeName}`;

  const rowNumber = await upsertMirrorRow(
    tab,
    {
      id: item.id,
      typeName,
      title: item.title,
      summary: item.summary ?? "",
      content: item.content,
      tags,
      status: item.status,
      updatedAt: new Date(item.updated_at).toISOString(),
    },
    item.mirror_row
  );

  await admin
    .from("knowledge_items")
    .update({ mirror_tab: tab, mirror_row: rowNumber || null })
    .eq("id", itemId);
}
