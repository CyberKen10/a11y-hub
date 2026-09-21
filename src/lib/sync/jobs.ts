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

export async function countReindexJobs(): Promise<{
  remaining: number;
  pending: number;
  failed: number;
  running: number;
  done: number;
}> {
  const admin = createAdminClient();
  const [pending, failed, running, done] = await Promise.all([
    admin
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "reindex")
      .eq("status", "pending"),
    admin
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "reindex")
      .eq("status", "failed"),
    admin
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "reindex")
      .eq("status", "running"),
    admin
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "reindex")
      .eq("status", "done"),
  ]);
  const pendingCount = pending.count ?? 0;
  const failedCount = failed.count ?? 0;
  const runningCount = running.count ?? 0;
  return {
    pending: pendingCount,
    failed: failedCount,
    running: runningCount,
    done: done.count ?? 0,
    remaining: pendingCount + failedCount + runningCount,
  };
}

/** Retries pending/failed reindex jobs (admin panel). */
export async function runPendingJobs(
  limit = 25
): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("sync_jobs")
    .select("id")
    .eq("kind", "reindex")
    .in("status", ["pending", "failed"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(limit);

  for (const job of jobs ?? []) {
    await processJob(job.id);
  }
  return { processed: jobs?.length ?? 0 };
}

/** Keeps running batches until the queue is empty or the cap is hit. */
export async function runAllPendingJobs(
  maxBatches = 20
): Promise<{ processed: number; remaining: number }> {
  let processed = 0;
  for (let i = 0; i < maxBatches; i++) {
    const batch = await runPendingJobs(25);
    processed += batch.processed;
    if (batch.processed === 0) break;
  }
  const counts = await countReindexJobs();
  return { processed, remaining: counts.remaining };
}
