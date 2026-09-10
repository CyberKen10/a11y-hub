import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SyncPanel } from "@/components/admin/sync-panel";
import type { SyncJob } from "@/lib/types";

export const metadata: Metadata = { title: "Sincronización" };

export default async function SyncPage() {
  await requireProfile("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("sync_jobs")
    .select("*, knowledge_items(title)")
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (data ?? []).map((job) => ({
    ...(job as unknown as SyncJob),
    item_title:
      (job.knowledge_items as unknown as { title: string } | null)?.title ??
      null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sincronización
        </h1>
        <p className="text-muted-foreground">
          Estado de la indexación RAG y del espejo en Google Sheets. Los
          trabajos fallidos se pueden reintentar sin pérdida de datos: la base
          de datos siempre es la fuente oficial.
        </p>
      </div>
      <SyncPanel jobs={jobs} />
    </div>
  );
}
