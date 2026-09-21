import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { countReindexJobs } from "@/lib/sync/jobs";
import { SyncPanel } from "@/components/admin/sync-panel";
import type { SyncJob } from "@/lib/types";

export const metadata: Metadata = { title: "Sincronización" };
export const maxDuration = 300;

const STATUS_ORDER: Record<string, number> = {
  failed: 0,
  pending: 1,
  running: 2,
  done: 3,
};

export default async function SyncPage() {
  await requireProfile("admin");
  const supabase = await createClient();

  const [{ data }, counts] = await Promise.all([
    supabase
      .from("sync_jobs")
      .select("*, knowledge_items(title, knowledge_types(name, slug))")
      .eq("kind", "reindex")
      .order("updated_at", { ascending: false })
      .limit(200),
    countReindexJobs(),
  ]);

  const jobs = (data ?? [])
    .map((job) => {
      const item = job.knowledge_items as unknown as {
        title: string;
        knowledge_types: { name: string; slug: string } | null;
      } | null;
      return {
        ...(job as unknown as SyncJob),
        item_title: item?.title ?? null,
        type_name: item?.knowledge_types?.name ?? null,
      };
    })
    .sort((a, b) => {
      const status =
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (status !== 0) return status;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="tracking-tight">
          Sincronización
        </h1>
        <p className="text-muted-foreground">
          Estado de la indexación del chat. Los trabajos fallidos se pueden
          reintentar: el contenido en el hub no se pierde.
        </p>
      </div>
      <SyncPanel jobs={jobs} counts={counts} />
    </div>
  );
}
