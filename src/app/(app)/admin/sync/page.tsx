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
    .eq("kind", "reindex")
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
        <h1 className="tracking-tight">
          Sincronización
        </h1>
        <p className="text-muted-foreground">
          Estado de la indexación del chat. Los trabajos fallidos se pueden
          reintentar: el contenido en el hub no se pierde.
        </p>
      </div>
      <SyncPanel jobs={jobs} />
    </div>
  );
}
