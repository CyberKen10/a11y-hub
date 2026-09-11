import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireProfile, canEdit } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/items/markdown";
import { ItemActions } from "@/components/items/item-actions";
import { VersionList } from "@/components/items/version-list";
import {
  AttachmentSection,
  type AttachmentView,
} from "@/components/items/attachment-section";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApproachFicha, ApprovalBadge } from "@/components/items/approach-ficha";
import {
  INTERNAL_META_KEYS,
  WIKI_FICHA_FIELDS,
  getApprovalState,
  getApproverCount,
  looksLikeApproach,
} from "@/lib/approaches";
import { isActiveTypeSlug } from "@/lib/knowledge-sections";
import type {
  KnowledgeFieldDef,
  KnowledgeVersion,
  SourceRef,
  Tag,
} from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

const META_LABEL: Record<string, string> = {
  wiki_id: "ID Wiki",
  Origen: "Pestaña wiki",
  Status: "Status",
  CP: "CP",
  "Bug Type": "Bug Type",
  Platform: "Platform",
  Team: "Team",
  UTest: "UTest",
  Crownspeak: "Crownspeak",
  Barcelo: "Barcelo",
};

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("knowledge_items")
    .select(
      "*, knowledge_types(slug, name, fields), item_tags(tags(id, name, slug)), sources(id, label, url)"
    )
    .eq("id", id)
    .single();

  if (!item) notFound();

  const itemTypeSlug = (
    item.knowledge_types as unknown as { slug?: string } | null
  )?.slug;
  if (!isActiveTypeSlug(itemTypeSlug)) notFound();

  const { data: versionsData } = await supabase
    .from("knowledge_versions")
    .select("id, version, title, status, created_at")
    .eq("item_id", id)
    .order("version", { ascending: false })
    .limit(20);

  const { data: attachmentsData } = await supabase
    .from("attachments")
    .select("id, file_name, storage_path, size_bytes")
    .eq("item_id", id)
    .order("created_at");

  // Signed URLs (1 hour) generated server-side; the bucket is private.
  const admin = createAdminClient();
  const attachments: AttachmentView[] = await Promise.all(
    (attachmentsData ?? []).map(async (att) => {
      const { data: signed } = await admin.storage
        .from("attachments")
        .createSignedUrl(att.storage_path, 3600);
      return {
        id: att.id,
        file_name: att.file_name,
        size_bytes: att.size_bytes,
        signedUrl: signed?.signedUrl ?? null,
      };
    })
  );

  const { data: relationsData } = await supabase
    .from("item_relations")
    .select("id, relation, to_item_id, to_item:knowledge_items!item_relations_to_item_id_fkey(id, title)")
    .eq("from_item_id", id);

  const type = item.knowledge_types as unknown as {
    slug: string;
    name: string;
    fields: KnowledgeFieldDef[];
  } | null;
  const tags = ((item.item_tags as unknown as { tags: Tag }[]) ?? [])
    .map((t) => t.tags)
    .filter(Boolean);
  const sources = (item.sources ?? []) as SourceRef[];
  const versions = (versionsData ?? []) as KnowledgeVersion[];
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const editable = canEdit(profile.role);

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <nav aria-label="Miga de pan" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/library" className="hover:underline">
              Biblioteca
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/library/${type?.slug ?? ""}`}
              className="hover:underline"
            >
              {type?.name ?? "Sin tipo"}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{type?.name}</Badge>
          <Badge variant={item.status === "published" ? "default" : "outline"}>
            {STATUS_LABEL[item.status]}
          </Badge>
          {looksLikeApproach(metadata, type?.slug) && (
            <ApprovalBadge
              state={getApprovalState(metadata)}
              count={
                getApprovalState(metadata) === "discarded"
                  ? undefined
                  : getApproverCount(metadata)
              }
            />
          )}
          <span className="text-sm text-muted-foreground">
            Actualizado{" "}
            {new Intl.DateTimeFormat("es", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(item.updated_at))}
          </span>
        </div>
        <h1 className="tracking-tight">{item.title}</h1>
        {item.summary && (
          <p className="text-lg text-muted-foreground">{item.summary}</p>
        )}
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Badge variant="outline">{tag.name}</Badge>
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <ItemActions
            itemId={item.id}
            status={item.status}
            isAdmin={profile.role === "admin"}
          />
        )}
      </header>

      <Separator />

      {looksLikeApproach(metadata, type?.slug) && (
        <>
          <ApproachFicha
            itemId={item.id}
            metadata={metadata}
            canApprove
            currentUserId={profile.id}
          />
          <Separator />
        </>
      )}

      <Markdown>{item.content}</Markdown>

      {(() => {
        // Defined type fields first (with their label), then leftover metadata.
        const fieldDefs = type?.fields ?? [];
        const covered = new Set([
          ...fieldDefs.map((f) => f.key),
          ...WIKI_FICHA_FIELDS.map((f) => f.key),
          ...INTERNAL_META_KEYS,
        ]);
        const entries: { key: string; label: string; value: unknown }[] = [
          ...fieldDefs
            .filter((f) => metadata[f.key] != null && metadata[f.key] !== "")
            .map((f) => ({ key: f.key, label: f.label, value: metadata[f.key] })),
          ...Object.entries(metadata)
            .filter(([k, v]) => !covered.has(k) && v != null && v !== "")
            .map(([k, v]) => ({ key: k, label: META_LABEL[k] ?? k, value: v })),
        ];
        if (entries.length === 0) return null;
        return (
          <section aria-labelledby="campos-heading" className="space-y-3">
            <h2 id="campos-heading" className="font-bold">
              Campos específicos
            </h2>
            <dl className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
              {entries.map((entry) => (
                <div key={entry.key}>
                  <dt className="text-sm font-medium text-muted-foreground">
                    {entry.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">
                    {Array.isArray(entry.value)
                      ? (entry.value as unknown[]).map(String).join(", ")
                      : String(entry.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })()}

      {sources.length > 0 && (
        <section aria-labelledby="fuentes-heading" className="space-y-3">
          <h2 id="fuentes-heading" className="font-bold">
            Fuentes
          </h2>
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="text-sm">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-4"
                  >
                    {s.label}
                    <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="sr-only">(se abre en una pestaña nueva)</span>
                  </a>
                ) : (
                  s.label
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(relationsData ?? []).length > 0 && (
        <section aria-labelledby="relaciones-heading" className="space-y-3">
          <h2 id="relaciones-heading" className="font-bold">
            Relacionado
          </h2>
          <ul className="space-y-1.5">
            {(relationsData ?? []).map((rel) => {
              const target = rel.to_item as unknown as {
                id: string;
                title: string;
              } | null;
              if (!target) return null;
              return (
                <li key={rel.id} className="text-sm">
                  <Link
                    href={`/items/${target.id}`}
                    className="underline underline-offset-4"
                  >
                    {target.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({rel.relation})</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Separator />

      <AttachmentSection
        itemId={item.id}
        attachments={attachments}
        canEdit={editable}
      />

      <Separator />

      <section aria-labelledby="versiones-heading" className="space-y-3">
        <h2 id="versiones-heading" className="font-bold">
          Historial de versiones
        </h2>
        <VersionList itemId={item.id} versions={versions} canRestore={editable} />
      </section>
    </article>
  );
}
