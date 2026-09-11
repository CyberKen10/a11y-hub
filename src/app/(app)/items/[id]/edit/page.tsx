import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "@/components/items/item-form";
import { ACTIVE_TYPE_SLUG_LIST, isActiveTypeSlug } from "@/lib/knowledge-sections";
import type { KnowledgeType, SourceRef, Tag } from "@/lib/types";

export const metadata: Metadata = { title: "Editar contenido" };

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile("editor");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: types }, { data: item }] = await Promise.all([
    supabase
      .from("knowledge_types")
      .select("slug, name, fields")
      .in("slug", ACTIVE_TYPE_SLUG_LIST)
      .order("sort_order"),
    supabase
      .from("knowledge_items")
      .select(
        "*, knowledge_types(slug), item_tags(tags(id, name, slug)), sources(id, label, url)"
      )
      .eq("id", id)
      .single(),
  ]);

  if (!item) notFound();

  const itemTypeSlug = (
    item.knowledge_types as unknown as { slug?: string } | null
  )?.slug;
  if (!isActiveTypeSlug(itemTypeSlug)) notFound();

  const typeList = (types ?? []) as Pick<
    KnowledgeType,
    "slug" | "name" | "fields"
  >[];
  const tags = ((item.item_tags as unknown as { tags: Tag }[]) ?? [])
    .map((t) => t.tags?.name)
    .filter(Boolean);
  const sources = ((item.sources ?? []) as SourceRef[]).map((s) => ({
    label: s.label,
    url: s.url,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="tracking-tight">
        Editar: {item.title}
      </h1>
      <ItemForm
        types={typeList}
        initial={{
          id: item.id,
          type_slug: (() => {
            const slug =
              (item.knowledge_types as unknown as { slug?: string } | null)
                ?.slug ?? typeList[0]?.slug;
            return isActiveTypeSlug(slug) ? slug : "";
          })(),
          title: item.title,
          summary: item.summary ?? "",
          content: item.content,
          metadata: (item.metadata ?? {}) as Record<string, unknown>,
          tags,
          sources,
          status: item.status,
        }}
      />
    </div>
  );
}
