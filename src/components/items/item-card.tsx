import Link from "next/link";
import { ApprovalBadge } from "@/components/items/approach-ficha";
import { WcagScBadges } from "@/components/items/wcag-badges";
import {
  COMPANY_FIELDS,
  getApprovalState,
  getApproverCount,
  looksLikeApproach,
} from "@/lib/approaches";
import { Badge } from "@/components/ui/badge";
import { getItemWcagSuccessCriteria, getRawWcagCp } from "@/lib/wcag";
import type { KnowledgeItemWithType } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export function ItemCard({ item }: { item: KnowledgeItemWithType }) {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const isApproach = looksLikeApproach(metadata, item.knowledge_types?.slug);
  const showWcag =
    isApproach ||
    getItemWcagSuccessCriteria(metadata).length > 0 ||
    Boolean(getRawWcagCp(metadata));
  const companyBits = COMPANY_FIELDS.map(({ key, label }) => {
    const value = metadata[key];
    if (value == null || String(value).trim() === "") return null;
    return `${label}: ${String(value)}`;
  }).filter(Boolean);

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex h-full min-w-0 flex-col gap-2 rounded-2xl bg-card p-4 text-card-foreground shadow-[0_8px_28px_rgb(27_67_50_/_6%)] transition-shadow hover:shadow-[0_12px_32px_rgb(27_67_50_/_10%)] focus-visible:outline-2 focus-visible:outline-ring md:p-5"
    >
      {showWcag && (
        <WcagScBadges metadata={metadata} emptyLabel={isApproach ? "Sin SC" : null} />
      )}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="min-w-0 break-words leading-snug">{item.title}</h3>
        <div className="flex flex-wrap gap-1 sm:shrink-0 sm:flex-col sm:items-end">
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
