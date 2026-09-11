import Link from "next/link";
import { ApprovalBadge } from "@/components/items/approach-ficha";
import {
  COMPANY_FIELDS,
  getApprovalState,
  getApproverCount,
  looksLikeApproach,
} from "@/lib/approaches";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeItemWithType } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export function ItemCard({ item }: { item: KnowledgeItemWithType }) {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const isApproach = looksLikeApproach(metadata, item.knowledge_types?.slug);
  const companyBits = COMPANY_FIELDS.map(({ key, label }) => {
    const value = metadata[key];
    if (value == null || String(value).trim() === "") return null;
    return `${label}: ${String(value)}`;
  }).filter(Boolean);

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex h-full flex-col gap-2 rounded-2xl bg-card p-5 shadow-[0_8px_28px_rgb(27_67_50_/_6%)] transition-shadow hover:shadow-[0_12px_32px_rgb(27_67_50_/_10%)] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="leading-snug">{item.title}</h3>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {typeof item.metadata?.wiki_id === "string" && (
            <Badge variant="outline" className="font-mono text-[0.7rem]">
              {item.metadata.wiki_id}
            </Badge>
          )}
          {isApproach && (
            <ApprovalBadge
              state={getApprovalState(metadata)}
              count={
                getApprovalState(metadata) === "discarded"
                  ? undefined
                  : getApproverCount(metadata)
              }
            />
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
      {companyBits.length > 0 && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {companyBits.join(" · ")}
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
