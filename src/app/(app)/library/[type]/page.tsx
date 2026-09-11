import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, PlusCircle } from "lucide-react";
import { requireProfile, canEdit } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemCard } from "@/components/items/item-card";
import { LibraryFilters } from "@/components/items/library-filters";
import { PaginationNav } from "@/components/items/pagination-nav";
import { Button } from "@/components/ui/button";
import { isActiveTypeSlug } from "@/lib/knowledge-sections";
import type { KnowledgeItemWithType, KnowledgeType } from "@/lib/types";
import { collectWcagFilterOptions, wcagScFilterClause } from "@/lib/wcag";

const PAGE_SIZE = 24;

export default async function TypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{
    q?: string;
    estado?: string;
    page?: string;
    aprobacion?: string;
    sc?: string;
  }>;
}) {
  const { type: typeSlug } = await params;
  if (!isActiveTypeSlug(typeSlug)) notFound();
  const { q, estado, page: pageRaw, aprobacion, sc } = await searchParams;
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
  if (
    typeSlug === "approaches" &&
    (aprobacion === "approved" ||
      aprobacion === "pending" ||
      aprobacion === "discarded")
  ) {
    query = query.eq("metadata->>approval_state", aprobacion);
  }
  const scClause =
    typeSlug === "approaches" ? wcagScFilterClause(sc ?? "") : null;
  if (scClause) query = query.or(scClause);

  const from = (page - 1) * PAGE_SIZE;
  const [{ data, count }, { data: wcagRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    typeSlug === "approaches"
      ? supabase
          .from("knowledge_items")
          .select("metadata")
          .eq("type_id", type.id)
      : Promise.resolve({ data: [] as { metadata?: Record<string, unknown> }[] }),
  ]);
  const total = count ?? 0;
  const items = (data ?? []) as unknown as KnowledgeItemWithType[];
  const wcagOptions =
    typeSlug === "approaches" ? collectWcagFilterOptions(wcagRows ?? []) : [];

  const qs = new URLSearchParams();
  if (q?.trim()) qs.set("q", q.trim());
  if (estado) qs.set("estado", estado);
  if (aprobacion) qs.set("aprobacion", aprobacion);
  if (scClause && sc) qs.set("sc", sc);
  const hrefForPage = (next: number) => {
    const params = new URLSearchParams(qs);
    if (next > 1) params.set("page", String(next));
    const suffix = params.toString();
    return suffix ? `/library/${type.slug}?${suffix}` : `/library/${type.slug}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="tracking-tight">{type.name}</h1>
          {type.description && (
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              {type.description}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/chat?scope=${type.slug}`}>
              <MessageSquare aria-hidden="true" />
              <span className="sm:hidden">Preguntar</span>
              <span className="hidden sm:inline">Preguntar sobre {type.name}</span>
            </Link>
          </Button>
          {canEdit(profile.role) && (
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/items/new?type=${type.slug}`}>
                <PlusCircle aria-hidden="true" />
                Añadir
              </Link>
            </Button>
          )}
        </div>
      </div>

      <LibraryFilters
        showApproval={type.slug === "approaches"}
        wcagOptions={wcagOptions}
      />

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
