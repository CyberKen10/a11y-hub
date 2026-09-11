"use client";

import { isActiveTypeSlug } from "@/lib/knowledge-sections";
import type { ExtractionResult } from "@/lib/schemas";
import type { KnowledgeType } from "@/lib/types";
import { composerFieldsFor, withAllComposerMetadata } from "@/lib/approaches";
import type { ExistingMatch } from "@/lib/actions/extract";
import { KnowledgeFieldControl } from "@/components/items/knowledge-field-control";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProposalEditor({
  proposal,
  types,
  existing,
  updateExisting,
  onUpdateExisting,
  onPatch,
  idPrefix,
}: {
  proposal: ExtractionResult;
  types: Pick<KnowledgeType, "slug" | "name" | "icon" | "fields">[];
  existing: ExistingMatch | null;
  updateExisting: boolean;
  onUpdateExisting: (value: boolean) => void;
  onPatch: (partial: Partial<ExtractionResult>) => void;
  idPrefix: string;
}) {
  const typeName = (slug: string) =>
    types.find((t) => t.slug === slug)?.name ?? slug;
  const typeFields = (slug: string) => types.find((t) => t.slug === slug)?.fields;
  const fieldDefs = composerFieldsFor(
    proposal.type_slug,
    typeFields(proposal.type_slug)
  );

  return (
    <div className="space-y-4">
      {existing && (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">
            Ya existe un elemento parecido: “{existing.title}”
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-update`}
              checked={updateExisting}
              onCheckedChange={(v) => onUpdateExisting(v === true)}
            />
            <Label htmlFor={`${idPrefix}-update`}>
              Actualizar el existente en lugar de crear uno nuevo
            </Label>
          </div>
          {updateExisting && (
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div>
                <dt className="inline font-medium">Título: </dt>
                <dd className="inline">
                  de “{existing.title}” a “{proposal.title}”
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Resumen: </dt>
                <dd className="inline">
                  de “{existing.summary ?? "(vacío)"}” a “{proposal.summary}”
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Apartado</Label>
          <Select
            value={proposal.type_slug}
            onValueChange={(v) => {
              if (!isActiveTypeSlug(v)) return;
              onPatch({
                type_slug: v,
                metadata: withAllComposerMetadata(
                  v,
                  proposal.metadata,
                  typeFields(v)
                ),
              });
            }}
          >
            <SelectTrigger id={`${idPrefix}-type`}>
              <SelectValue>{typeName(proposal.type_slug)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-tags`}>Etiquetas (coma)</Label>
          <Input
            id={`${idPrefix}-tags`}
            value={proposal.tags.join(", ")}
            onChange={(e) =>
              onPatch({
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Título</Label>
        <Input
          id={`${idPrefix}-title`}
          value={proposal.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-summary`}>Resumen</Label>
        <Textarea
          id={`${idPrefix}-summary`}
          value={proposal.summary}
          onChange={(e) => onPatch({ summary: e.target.value })}
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-content`}>Contenido (Markdown)</Label>
        <Textarea
          id={`${idPrefix}-content`}
          value={proposal.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          rows={10}
          className="font-mono text-sm"
        />
      </div>

      {fieldDefs.length > 0 && (
        <fieldset className="space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-sm font-semibold">
            Campos de {typeName(proposal.type_slug)}
          </legend>
          {fieldDefs.map((field) => (
            <KnowledgeFieldControl
              key={field.key}
              field={field}
              id={`${idPrefix}-meta-${field.key}`}
              value={proposal.metadata[field.key] ?? ""}
              onChange={(v) =>
                onPatch({
                  metadata: { ...proposal.metadata, [field.key]: v },
                })
              }
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}
