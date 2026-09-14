import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reindexItem } from "@/lib/rag/indexer";

const MAX_ATTEMPTS = 5;

type JobKind = "reindex";

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
    throw new Error(`No se pudo crear el trabajo de indexación: ${error?.message}`);
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
  if (job.kind !== "reindex") {
    await admin
      .from("sync_jobs")
      .update({ status: "done", last_error: null })
      .eq("id", jobId);
    return "done";
  }
  if (job.attempts >= MAX_ATTEMPTS) return "failed";

  await admin
    .from("sync_jobs")
    .update({ status: "running", attempts: job.attempts + 1 })
    .eq("id", jobId);

  try {
    await reindexItem(job.item_id!);
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

/** Retries pending/failed reindex jobs (admin panel). */
export async function runPendingJobs(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("sync_jobs")
    .select("id")
    .eq("kind", "reindex")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(25);

  for (const job of jobs ?? []) {
    await processJob(job.id);
  }
  return { processed: jobs?.length ?? 0 };
}
