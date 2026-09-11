"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { extractProposal, type ExistingMatch } from "@/lib/actions/extract";
import { saveItem } from "@/lib/actions/items";
import type { ExtractionResult } from "@/lib/schemas";
import type { KnowledgeType } from "@/lib/types";
import { withAllComposerMetadata } from "@/lib/approaches";
import { parseWcagSuccessCriteria } from "@/lib/wcag";
import { ProposalEditor } from "@/components/composer/proposal-editor";
import { MicButton } from "@/components/chat/mic-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Step = "input" | "analyzing" | "review";

export function KnowledgeComposer({
  open,
  onOpenChange,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: Pick<KnowledgeType, "slug" | "name" | "icon" | "fields">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [proposal, setProposal] = useState<ExtractionResult | null>(null);
  const [existing, setExisting] = useState<ExistingMatch | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);

  function typeFields(slug: string) {
    return types.find((t) => t.slug === slug)?.fields;
  }

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
        const padded: ExtractionResult = {
          ...result.proposal,
          metadata: withAllComposerMetadata(
            result.proposal.type_slug,
            result.proposal.metadata,
            typeFields(result.proposal.type_slug)
          ),
        };
        setProposal(padded);
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
      const metadata: Record<string, unknown> = { ...proposal.metadata };
      const scs = parseWcagSuccessCriteria(metadata.CP ?? metadata.wcag_refs);
      if (scs.length > 0) {
        metadata.wcag_scs = scs;
        if (!String(metadata.wcag_refs ?? "").trim()) {
          metadata.wcag_refs = scs.join(", ");
        }
      }
      const result = await saveItem({
        id: updateExisting && existing ? existing.id : undefined,
        type_slug: proposal.type_slug,
        title: proposal.title,
        summary: proposal.summary,
        content: proposal.content,
        metadata,
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
      <DialogContent className="max-h-[min(90svh,100%)] w-[calc(100%-1rem)] overflow-y-auto sm:w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir conocimiento con IA</DialogTitle>
          <DialogDescription>
            Describe el approach escribiendo o dictando. La IA completa toda la
            ficha (aunque falten datos) y tú revisas y confirmas antes de
            guardar.
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
                placeholder="p. ej. Approach para un botón sin nombre accesible en Android. La IA completa la ficha (SC, plataforma, clientes) aunque no lo dictes todo."
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
              Propuesta completa. La IA rellena todos los campos; lo que no
              viniera en el dictado lo interpreta. Revisa sobre todo SC WCAG,
              plataforma y clientes, ajusta y confirma.
            </p>
            <ProposalEditor
              proposal={proposal}
              types={types}
              existing={existing}
              updateExisting={updateExisting}
              onUpdateExisting={setUpdateExisting}
              onPatch={patch}
              idPrefix="composer"
            />
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
