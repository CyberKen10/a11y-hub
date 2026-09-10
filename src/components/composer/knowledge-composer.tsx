"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { extractProposal, type ExistingMatch } from "@/lib/actions/extract";
import { saveItem } from "@/lib/actions/items";
import type { ExtractionResult } from "@/lib/schemas";
import type { KnowledgeType } from "@/lib/types";
import { MicButton } from "@/components/chat/mic-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Step = "input" | "analyzing" | "review";

export function KnowledgeComposer({
  open,
  onOpenChange,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: Pick<KnowledgeType, "slug" | "name" | "icon">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [proposal, setProposal] = useState<ExtractionResult | null>(null);
  const [existing, setExisting] = useState<ExistingMatch | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);

  const typeName = useMemo(
    () => (slug: string) => types.find((t) => t.slug === slug)?.name ?? slug,
    [types]
  );

  function reset() {
    setStep("input");
    setRawText("");
    setProposal(null);
    setExisting(null);
    setUpdateExisting(false);
  }

  function analyze() {
    if (rawText.trim().length < 10) {
      toast.error("Escribe o dicta un poco más de contexto.");
      return;
    }
    setStep("analyzing");
    startTransition(async () => {
      const result = await extractProposal(rawText);
      if (result.ok) {
        setProposal(result.proposal);
        setExisting(result.existing);
        setUpdateExisting(false);
        setStep("review");
      } else {
        toast.error(result.error);
        setStep("input");
      }
    });
  }

  function save(status: "draft" | "published") {
    if (!proposal) return;
    startTransition(async () => {
      const result = await saveItem({
        id: updateExisting && existing ? existing.id : undefined,
        type_slug: proposal.type_slug,
        title: proposal.title,
        summary: proposal.summary,
        content: proposal.content,
        metadata: proposal.metadata,
        tags: proposal.tags,
        sources: proposal.sources.map((s) => ({
          label: s.label,
          url: s.url,
        })),
        status,
      });
      if (result.ok) {
        toast.success(
          status === "published"
            ? "Publicado: disponible en el chat y espejado en Sheets."
            : "Guardado como borrador."
        );
        onOpenChange(false);
        reset();
        router.push(`/items/${result.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const patch = (partial: Partial<ExtractionResult>) =>
    setProposal((p) => (p ? { ...p, ...partial } : p));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir conocimiento con IA</DialogTitle>
          <DialogDescription>
            Describe el approach, metodología u otro contenido escribiendo o
            dictando. La IA propone la estructura y tú revisas y confirmas
            antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="composer-text">Describe el contenido</Label>
              <Textarea
                id="composer-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={10}
                placeholder="p. ej. Quiero añadir un approach nuevo llamado 'Shift-left accessibility' que consiste en…"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <MicButton
                onTranscript={(text) =>
                  setRawText((prev) => (prev ? `${prev}\n${text}` : text))
                }
              />
              <Button onClick={analyze} disabled={pending}>
                <Sparkles aria-hidden="true" />
                Analizar con IA
              </Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div
            className="flex flex-col items-center gap-3 py-12"
            role="status"
          >
            <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Analizando y estructurando el contenido…
            </p>
          </div>
        )}

        {step === "review" && proposal && (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              Propuesta generada. Revisa, ajusta lo que necesites y confirma.
            </p>

            {existing && (
              <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">
                  Ya existe un elemento parecido: “{existing.title}”
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="composer-update"
                    checked={updateExisting}
                    onCheckedChange={(v) => setUpdateExisting(v === true)}
                  />
                  <Label htmlFor="composer-update">
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
                        de “{existing.summary ?? "(vacío)"}” a “
                        {proposal.summary}”
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Contenido: </dt>
                      <dd className="inline">
                        de {existing.content.length} a{" "}
                        {proposal.content.length} caracteres
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="composer-type">Apartado</Label>
                <Select
                  value={proposal.type_slug}
                  onValueChange={(v) => patch({ type_slug: v })}
                >
                  <SelectTrigger id="composer-type">
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
                <Label htmlFor="composer-tags">Etiquetas (coma)</Label>
                <Input
                  id="composer-tags"
                  value={proposal.tags.join(", ")}
                  onChange={(e) =>
                    patch({
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
              <Label htmlFor="composer-title">Título</Label>
              <Input
                id="composer-title"
                value={proposal.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="composer-summary">Resumen</Label>
              <Textarea
                id="composer-summary"
                value={proposal.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="composer-content">Contenido (Markdown)</Label>
              <Textarea
                id="composer-content"
                value={proposal.content}
                onChange={(e) => patch({ content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {Object.keys(proposal.metadata).length > 0 && (
              <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">
                  Campos específicos detectados
                </legend>
                {Object.entries(proposal.metadata).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`composer-meta-${key}`}>{key}</Label>
                    <Input
                      id={`composer-meta-${key}`}
                      value={value}
                      onChange={(e) =>
                        patch({
                          metadata: {
                            ...proposal.metadata,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </fieldset>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep("input")}
                disabled={pending}
              >
                <ArrowLeft aria-hidden="true" />
                Volver al texto
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => save("draft")}
                  disabled={pending}
                >
                  Guardar borrador
                </Button>
                <Button onClick={() => save("published")} disabled={pending}>
                  {pending ? "Guardando…" : "Confirmar y publicar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
