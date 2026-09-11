import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ItemCard } from "@/components/items/item-card";
import { LibraryFilters } from "@/components/items/library-filters";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import type { KnowledgeItemWithType } from "@/lib/types";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; aprobacion?: string }>;
}) {
  const { q, estado, aprobacion } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("knowledge_items")
    .select("id, title, summary, status, updated_at, metadata, knowledge_types!inner(slug, name, icon)")
    .in("knowledge_types.slug", ACTIVE_TYPE_SLUG_LIST)
    .order("updated_at", { ascending: false })
    .limit(60);

  if (q?.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (estado === "draft" || estado === "published" || estado === "archived") {
    query = query.eq("status", estado);
  } else {
    query = query.neq("status", "archived");
  }
  if (
    aprobacion === "approved" ||
    aprobacion === "pending" ||
    aprobacion === "discarded"
  ) {
    query = query.eq("metadata->>approval_state", aprobacion);
  }

  const { data } = await query;
  const items = (data ?? []) as unknown as KnowledgeItemWithType[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="tracking-tight">Biblioteca</h1>
        <p className="text-muted-foreground">
          Todo el conocimiento del hub en un solo lugar.
        </p>
      </div>

      <LibraryFilters showApproval />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No hay contenido que coincida con los filtros.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
