"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, CircleAlert, Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { extractMeetingNotes } from "@/lib/actions/meeting";
import { saveItem } from "@/lib/actions/items";
import { parseWcagSuccessCriteria } from "@/lib/wcag";
import { withAllComposerMetadata } from "@/lib/approaches";
import { transcriptToNotes } from "@/lib/transcript";
import { formatClientActionError } from "@/lib/ai-errors";
import type { ExtractionResult } from "@/lib/schemas";
import type { MeetingAgreement } from "@/lib/extract-types";
import type { KnowledgeType } from "@/lib/types";
import { ProposalEditor } from "@/components/composer/proposal-editor";
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

interface Row extends MeetingAgreement {
  status: RowStatus;
  savedId?: string;
}

export function MeetingNotesComposer({
  open,
  onOpenChange,
  types,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: Pick<KnowledgeType, "slug" | "name" | "icon" | "fields">[];
}) {
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
  }

  function showError(message: string) {
    setErrorText(message);
    toast.error(message, { duration: 12000 });
    setStep("input");
  }

  function analyze() {
    if (rawText.trim().length < 40) {
      showError("Pega los acuerdos de la reunión.");
      return;
    }
    setErrorText(null);
    setStep("analyzing");
    startTransition(async () => {
      try {
        const result = await extractMeetingNotes(rawText);
        if (!result.ok) {
          showError(result.error);
          return;
        }
        if (result.agreements.length === 0) {
          showError("No hay acuerdos para convertir en fichas.");
          return;
        }
        setRows(
          result.agreements.map((a) => ({
            ...a,
            proposal: {
              ...a.proposal,
              metadata: withAllComposerMetadata(
                a.proposal.type_slug,
                a.proposal.metadata,
                types.find((t) => t.slug === a.proposal.type_slug)?.fields
              ),
            },
            status: "pending" as const,
          }))
        );
        setStep("list");
      } catch (error) {
        showError(formatClientActionError("meeting", error));
      }
    });
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setRawText(transcriptToNotes(text));
    toast.success(`Cargado: ${file.name}`);
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
      setStep("list");
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
          <DialogTitle>Acuerdos de reunión</DialogTitle>
          <DialogDescription>
            Pega los acuerdos. Se crea una ficha por cada uno; publica solo las
            que quieras.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            {errorText && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>No se pudieron organizar los acuerdos</AlertTitle>
                <AlertDescription>
                  <p className="whitespace-pre-wrap">{errorText}</p>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="meeting-notes">Acuerdos</Label>
              <Textarea
                id="meeting-notes"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={14}
                placeholder="Pega los acuerdos de la reunión."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
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
                  Subir archivo
                </Button>
              </div>
              <Button onClick={analyze} disabled={pending}>
                <NotebookPen aria-hidden="true" />
                Organizar acuerdos
              </Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-12" role="status">
            <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Organizando las fichas…
            </p>
          </div>
        )}

        {step === "list" && (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              {rows.length} acuerdo{rows.length === 1 ? "" : "s"}. Pendientes:{" "}
              {pendingCount}. Publicados: {savedCount}.
            </p>
            <ul className="space-y-2">
              {rows.map((row, index) => (
                <li
                  key={row.id}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <Badge variant="outline">{typeName(row.proposal.type_slug)}</Badge>
                    {row.status === "saved" && (
                      <Badge>Publicado</Badge>
                    )}
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
              Acuerdo: {active.decision}
            </p>
            <ProposalEditor
              proposal={active.proposal}
              types={types}
              existing={active.existing}
              updateExisting={updateExisting}
              onUpdateExisting={setUpdateExisting}
              onPatch={patchActive}
              idPrefix={`meeting-${active.id}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setActiveId(null);
                  setStep("list");
                }}
                disabled={pending}
              >
                <ArrowLeft aria-hidden="true" />
                Volver a la lista
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => skip(active.id)}
                  disabled={pending}
                >
                  Descartar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveActive("draft")}
                  disabled={pending}
                >
                  Guardar borrador
                </Button>
                <Button onClick={() => saveActive("published")} disabled={pending}>
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
