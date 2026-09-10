import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemForm } from "@/components/items/item-form";
import type { KnowledgeType } from "@/lib/types";

export const metadata: Metadata = { title: "Nuevo contenido" };

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireProfile("editor");
  const { type } = await searchParams;
  const supabase = await createClient();

  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name, fields")
    .order("sort_order");

  const typeList = (types ?? []) as Pick<
    KnowledgeType,
    "slug" | "name" | "fields"
  >[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nuevo contenido
        </h1>
        <p className="text-muted-foreground">
          También puedes crearlo dictando o escribiendo un prompt con el botón
          “Añadir con IA” de la barra superior.
        </p>
      </div>
      <ItemForm
        types={typeList}
        initial={{
          type_slug: type ?? typeList[0]?.slug ?? "",
          title: "",
          summary: "",
          content: "",
          metadata: {},
          tags: [],
          sources: [],
          status: "draft",
        }}
      />
    </div>
  );
}
