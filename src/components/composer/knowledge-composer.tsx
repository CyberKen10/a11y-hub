"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { extractProposal } from "@/lib/actions/extract";
import { saveItem } from "@/lib/actions/items";
import { parseWcagSuccessCriteria } from "@/lib/wcag";
import { withAllComposerMetadata } from "@/lib/approaches";
import { transcriptToNotes } from "@/lib/transcript";
import { formatClientActionError } from "@/lib/ai-errors";
import type { ExtractionResult } from "@/lib/schemas";
import type { ComposerDraft } from "@/lib/extract-types";
import type { KnowledgeType } from "@/lib/types";
import { ProposalEditor } from "@/components/composer/proposal-editor";
import { MicButton } from "@/components/chat/mic-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Step = "input" | "analyzing" | "list" | "review";
type RowStatus = "pending" | "saved" | "skipped";

interface Row extends ComposerDraft {
  status: RowStatus;
  savedId?: string;
}

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);

  const active = rows.find((r) => r.id === activeId) ?? null;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const savedCount = rows.filter((r) => r.status === "saved").length;

  function typeName(slug: string) {
    return types.find((t) => t.slug === slug)?.name ?? slug;
  }

  function reset() {
    setStep("input");
    setRawText("");
    setErrorText(null);
    setRows([]);
    setActiveId(null);
    setUpdateExisting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function showError(message: string) {
    setErrorText(message);
    toast.error(message, { duration: 12000 });
    setStep("input");
  }

  function goBackFromReview() {
    setActiveId(null);
    setUpdateExisting(false);
    setStep(rows.length === 1 ? "input" : "list");
  }

  function analyze() {
    if (rawText.trim().length < 10) {
      showError("Añade un poco más de texto.");
      return;
    }
    setErrorText(null);
    setStep("analyzing");
    startTransition(async () => {
      try {
        const result = await extractProposal(rawText);
        if (!result.ok) {
          showError(result.error);
          return;
        }
        if (result.items.length === 0) {
          showError("No hay contenido para convertir en fichas.");
          return;
        }
        const nextRows: Row[] = result.items.map((item) => ({
          ...item,
          proposal: {
            ...item.proposal,
            metadata: withAllComposerMetadata(
              item.proposal.type_slug,
              item.proposal.metadata,
              types.find((t) => t.slug === item.proposal.type_slug)?.fields
            ),
          },
          status: "pending",
        }));
        setRows(nextRows);
        setUpdateExisting(false);
        if (nextRows.length === 1) {
          setActiveId(nextRows[0].id);
          setStep("review");
        } else {
          setActiveId(null);
          setStep("list");
        }
      } catch (error) {
        showError(formatClientActionError("extract", error));
      }
    });
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setRawText(transcriptToNotes(text));
    toast.success(`Cargado: ${file.name}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  function patchActive(partial: Partial<ExtractionResult>) {
    if (!activeId) return;
    setRows((list) =>
      list.map((row) =>
        row.id === activeId
          ? { ...row, proposal: { ...row.proposal, ...partial } }
          : row
      )
    );
  }

  function skip(id: string) {
    setRows((list) =>
      list.map((row) => (row.id === id ? { ...row, status: "skipped" } : row))
    );
    if (activeId === id) {
      setActiveId(null);
      setUpdateExisting(false);
      setStep(rows.length === 1 ? "input" : "list");
    }
  }

  function saveActive(status: "draft" | "published") {
    if (!active) return;
    startTransition(async () => {
      const metadata: Record<string, unknown> = { ...active.proposal.metadata };
      const scs = parseWcagSuccessCriteria(metadata.CP ?? metadata.wcag_refs);
      if (scs.length > 0) {
        metadata.wcag_scs = scs;
        if (!String(metadata.wcag_refs ?? "").trim()) {
          metadata.wcag_refs = scs.join(", ");
        }
      }
      const result = await saveItem({
        id:
          updateExisting && active.existing ? active.existing.id : undefined,
        type_slug: active.proposal.type_slug,
        title: active.proposal.title,
        summary: active.proposal.summary,
        content: active.proposal.content,
        metadata,
        tags: active.proposal.tags,
        sources: active.proposal.sources.map((s) => ({
          label: s.label,
          url: s.url,
        })),
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "published" ? "Publicado." : "Borrador guardado."
      );
      const remaining = rows.filter(
        (row) => row.id !== active.id && row.status === "pending"
      );
      if (rows.length === 1 || remaining.length === 0) {
        onOpenChange(false);
        reset();
        router.push(`/items/${result.id}`);
        return;
      }
      setRows((list) =>
        list.map((row) =>
          row.id === active.id
            ? { ...row, status: "saved", savedId: result.id }
            : row
        )
      );
      setActiveId(null);
      setUpdateExisting(false);
      setStep("list");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[min(90svh,100%)] w-[calc(100%-1rem)] overflow-y-auto sm:w-full sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Añadir contenido</DialogTitle>
          <DialogDescription>
            Escribe, dicta o sube un .txt. Si hay un tema, una ficha; si hay
            varios, una por cada uno. Publica solo las que quieras.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            {errorText && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>No se pudieron crear las fichas</AlertTitle>
                <AlertDescription>
                  <p className="whitespace-pre-wrap">{errorText}</p>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="composer-text">Contenido</Label>
              <Textarea
                id="composer-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={12}
                placeholder="Approach, metodología, herramienta o plantilla. Si pegas varios temas, se crea una ficha por cada uno."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <MicButton
                  onTranscript={(text) =>
                    setRawText((prev) => (prev ? `${prev}\n${text}` : text))
                  }
                />
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.vtt,.srt,.md,text/plain"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Subir .txt
                </Button>
              </div>
              <Button onClick={analyze} disabled={pending}>
                <Plus aria-hidden="true" />
                Crear fichas
              </Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-12" role="status">
            <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Preparando las fichas…
            </p>
          </div>
        )}

        {step === "list" && (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              {rows.length} ficha{rows.length === 1 ? "" : "s"}. Pendientes:{" "}
              {pendingCount}. Publicadas: {savedCount}.
            </p>
            <ul className="space-y-2">
              {rows.map((row, index) => (
                <li key={row.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <Badge variant="outline">
                      {typeName(row.proposal.type_slug)}
                    </Badge>
                    {row.status === "saved" && <Badge>Publicado</Badge>}
                    {row.status === "skipped" && (
                      <Badge variant="secondary">Descartado</Badge>
                    )}
                  </div>
                  <p className="font-medium">{row.proposal.title}</p>
                  <p className="text-sm text-muted-foreground">{row.decision}</p>
                  {row.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveId(row.id);
                          setUpdateExisting(false);
                          setStep("review");
                        }}
                      >
                        Revisar ficha
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => skip(row.id)}
                      >
                        Descartar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("input")}>
                <ArrowLeft aria-hidden="true" />
                Volver al texto
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {step === "review" && active && (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              {active.decision}
            </p>
            <ProposalEditor
              proposal={active.proposal}
              types={types}
              existing={active.existing}
              updateExisting={updateExisting}
              onUpdateExisting={setUpdateExisting}
              onPatch={patchActive}
              idPrefix={`composer-${active.id}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={goBackFromReview}
                disabled={pending}
              >
                <ArrowLeft aria-hidden="true" />
                {rows.length === 1 ? "Volver al texto" : "Volver a la lista"}
              </Button>
              <div className="flex flex-wrap gap-2">
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => skip(active.id)}
                    disabled={pending}
                  >
                    Descartar
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => saveActive("draft")}
                  disabled={pending}
                >
                  Guardar borrador
                </Button>
                <Button
                  onClick={() => saveActive("published")}
                  disabled={pending}
                >
                  {pending ? "Guardando…" : "Publicar esta ficha"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
