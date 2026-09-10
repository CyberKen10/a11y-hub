import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeItemWithType } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export function ItemCard({ item }: { item: KnowledgeItemWithType }) {
  return (
    <Link
      href={`/items/${item.id}`}
      className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium leading-snug">{item.title}</h3>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {typeof item.metadata?.wiki_id === "string" && (
            <Badge variant="outline" className="font-mono text-[0.7rem]">
              {item.metadata.wiki_id}
            </Badge>
          )}
          {item.status !== "published" && (
            <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
          )}
        </div>
      </div>
      {item.summary && (
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {item.summary}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Badge variant="secondary">{item.knowledge_types?.name ?? "—"}</Badge>
        <span className="text-xs text-muted-foreground">
          Actualizado{" "}
          {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
            new Date(item.updated_at)
          )}
        </span>
      </div>
    </Link>
  );
}
