import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, PlusCircle } from "lucide-react";
import { requireProfile, canEdit } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemCard } from "@/components/items/item-card";
import { LibraryFilters } from "@/components/items/library-filters";
import { PaginationNav } from "@/components/items/pagination-nav";
import { Button } from "@/components/ui/button";
import type { KnowledgeItemWithType, KnowledgeType } from "@/lib/types";

const PAGE_SIZE = 24;

export default async function TypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  const { type: typeSlug } = await params;
  const { q, estado, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: type } = await supabase
    .from("knowledge_types")
    .select("*")
    .eq("slug", typeSlug)
    .single<KnowledgeType>();

  if (!type) notFound();

  let query = supabase
    .from("knowledge_items")
    .select(
      "id, title, summary, status, updated_at, metadata, knowledge_types(slug, name, icon)",
      { count: "exact" }
    )
    .eq("type_id", type.id)
    .order("title", { ascending: true });

  if (q?.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (estado === "draft" || estado === "published" || estado === "archived") {
    query = query.eq("status", estado);
  } else {
    query = query.neq("status", "archived");
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const items = (data ?? []) as unknown as KnowledgeItemWithType[];

  const qs = new URLSearchParams();
  if (q?.trim()) qs.set("q", q.trim());
  if (estado) qs.set("estado", estado);
  const hrefForPage = (next: number) => {
    const params = new URLSearchParams(qs);
    if (next > 1) params.set("page", String(next));
    const suffix = params.toString();
    return suffix ? `/library/${type.slug}?${suffix}` : `/library/${type.slug}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{type.name}</h1>
          {type.description && (
            <p className="max-w-2xl text-muted-foreground">{type.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/chat?scope=${type.slug}`}>
              <MessageSquare aria-hidden="true" />
              Preguntar sobre {type.name}
            </Link>
          </Button>
          {canEdit(profile.role) && (
            <Button asChild>
              <Link href={`/items/new?type=${type.slug}`}>
                <PlusCircle aria-hidden="true" />
                Añadir
              </Link>
            </Button>
          )}
        </div>
      </div>

      <LibraryFilters />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Este apartado todavía no tiene contenido que coincida con los filtros.
        </p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} />
              </li>
            ))}
          </ul>
          <PaginationNav
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hrefForPage={hrefForPage}
          />
        </>
      )}
    </div>
  );
}
