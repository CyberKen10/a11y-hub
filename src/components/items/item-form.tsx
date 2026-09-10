"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveItem } from "@/lib/actions/items";
import type { KnowledgeItemInput } from "@/lib/schemas";
import type { KnowledgeFieldDef, KnowledgeType } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

export interface ItemFormInitial {
  id?: string;
  type_slug: string;
  title: string;
  summary: string;
  content: string;
  metadata: Record<string, unknown>;
  tags: string[];
  sources: { label: string; url: string | null }[];
  status: "draft" | "published" | "archived";
}

export function ItemForm({
  types,
  initial,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "fields">[];
  initial: ItemFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [typeSlug, setTypeSlug] = useState(initial.type_slug);
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [content, setContent] = useState(initial.content);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [metadata, setMetadata] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial.metadata).map(([k, v]) => [
        k,
        Array.isArray(v) ? (v as unknown[]).map(String).join(", ") : String(v ?? ""),
      ])
    )
  );
  const [sources, setSources] = useState(
    initial.sources.map((s) => ({ label: s.label, url: s.url ?? "" }))
  );

  const currentType = useMemo(
    () => types.find((t) => t.slug === typeSlug),
    [types, typeSlug]
  );
  const fieldDefs: KnowledgeFieldDef[] = currentType?.fields ?? [];

  function submit(status: "draft" | "published") {
    const payload: KnowledgeItemInput = {
      id: initial.id,
      type_slug: typeSlug,
      title: title.trim(),
      summary: summary.trim(),
      content,
      metadata,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sources: sources
        .filter((s) => s.label.trim())
        .map((s) => ({ label: s.label.trim(), url: s.url.trim() || null })),
      status,
    };

    startTransition(async () => {
      const result = await saveItem(payload);
      if (result.ok) {
        toast.success(
          status === "published"
            ? "Guardado y publicado: ya está disponible en el chat y en Sheets."
            : "Borrador guardado."
        );
        router.push(`/items/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("draft");
      }}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="item-type">Apartado</Label>
          <Select value={typeSlug} onValueChange={setTypeSlug}>
            <SelectTrigger id="item-type">
              <SelectValue placeholder="Selecciona un apartado" />
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
          <Label htmlFor="item-tags">Etiquetas (separadas por coma)</Label>
          <Input
            id="item-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="wcag, formularios, aria"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-title">Título</Label>
        <Input
          id="item-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-summary">Resumen</Label>
        <Textarea
          id="item-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          aria-describedby="item-summary-help"
        />
        <p id="item-summary-help" className="text-xs text-muted-foreground">
          1–3 frases. Se muestra en las tarjetas y ayuda a la búsqueda.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item-content">Contenido (Markdown)</Label>
        <Textarea
          id="item-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          required
          className="font-mono text-sm"
        />
      </div>

      {fieldDefs.length > 0 && (
        <fieldset className="space-y-4 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">
            Campos de {currentType?.name}
          </legend>
          {fieldDefs.map((field) => {
            const id = `field-${field.key}`;
            const value = metadata[field.key] ?? "";
            const onChange = (v: string) =>
              setMetadata((m) => ({ ...m, [field.key]: v }));
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={id}>{field.label}</Label>
                {field.kind === "textarea" ? (
                  <Textarea
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.kind === "url" ? "url" : "text"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-describedby={
                      field.kind === "list" ? `${id}-help` : undefined
                    }
                  />
                )}
                {field.kind === "list" && (
                  <p id={`${id}-help`} className="text-xs text-muted-foreground">
                    Valores separados por coma.
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Fuentes</legend>
        {sources.map((s, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label htmlFor={`source-label-${i}`}>Descripción</Label>
              <Input
                id={`source-label-${i}`}
                value={s.label}
                onChange={(e) =>
                  setSources((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x))
                  )
                }
              />
            </div>
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label htmlFor={`source-url-${i}`}>URL (opcional)</Label>
              <Input
                id={`source-url-${i}`}
                type="url"
                value={s.url}
                onChange={(e) =>
                  setSources((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                  )
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar fuente ${i + 1}`}
              onClick={() => setSources((arr) => arr.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSources((arr) => [...arr, { label: "", url: "" }])}
        >
          Añadir fuente
        </Button>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => submit("published")}
        >
          {pending ? "Guardando…" : "Guardar y publicar"}
        </Button>
      </div>
    </form>
  );
}
