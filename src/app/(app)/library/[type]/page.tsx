import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, PlusCircle } from "lucide-react";
import { requireProfile, canEdit } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemCard } from "@/components/items/item-card";
import { Button } from "@/components/ui/button";
import type { KnowledgeItemWithType, KnowledgeType } from "@/lib/types";

export default async function TypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: typeSlug } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: type } = await supabase
    .from("knowledge_types")
    .select("*")
    .eq("slug", typeSlug)
    .single<KnowledgeType>();

  if (!type) notFound();

  const { data } = await supabase
    .from("knowledge_items")
    .select("id, title, summary, status, updated_at, knowledge_types(slug, name, icon)")
    .eq("type_id", type.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);

  const items = (data ?? []) as unknown as KnowledgeItemWithType[];

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

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Este apartado todavía no tiene contenido.
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
