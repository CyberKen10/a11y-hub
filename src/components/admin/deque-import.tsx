"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import {
  importDequeFolder,
  importDequeUpload,
} from "@/lib/actions/deque";
import type { WikiSeedSummary } from "@/lib/import/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DequeImport({
  typeReady,
  itemCount,
}: {
  typeReady: boolean;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<WikiSeedSummary | null>(null);
  const [chosen, setChosen] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function applyResult(
    result: { ok: true; summary: WikiSeedSummary } | { ok: false; error: string }
  ) {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSummary(result.summary);
    toast.success(
      `Deque listo: ${result.summary.created} nuevas, ${result.summary.updated} actualizadas, ${result.summary.skipped} igual. Véalas en Biblioteca → Deque.`
    );
    router.refresh();
  }

  function importFiles(list: FileList | null) {
    if (!list?.length) {
      toast.error("Selecciona uno o más .docx.");
      return;
    }
    const formData = new FormData();
    for (const file of Array.from(list)) formData.append("files", file);
    startTransition(async () => {
      applyResult(await importDequeUpload(formData));
      if (fileRef.current) fileRef.current.value = "";
      setChosen(0);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" />
          Cargar Deque
        </CardTitle>
        <CardDescription>
          Elige los .docx y se importan al momento. Elegirlos en el recuadro no
          basta: hay que esperar a “Importando…”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!typeReady && (
          <Alert variant="destructive">
            <AlertTitle>Falta el apartado Deque en la base</AlertTitle>
            <AlertDescription>
              Ejecuta en Supabase el SQL{" "}
              <code>supabase/migrations/20260921000000_deque_section.sql</code>
              {" "}y recarga esta página.
            </AlertDescription>
          </Alert>
        )}
        {typeReady && (
          <p className="text-sm text-muted-foreground">
            En el hub hay{" "}
            <strong>
              {itemCount} ficha{itemCount === 1 ? "" : "s"}
            </strong>{" "}
            de Deque.{" "}
            {itemCount > 0 ? (
              <Link href="/library/deque" className="underline underline-offset-4">
                Ver apartado
              </Link>
            ) : (
              "Todavía no se ha importado nada."
            )}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="deque-files">Archivos .docx</Label>
          <Input
            ref={fileRef}
            id="deque-files"
            type="file"
            accept=".docx,.md,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            disabled={pending || !typeReady}
            onChange={(e) => {
              const list = e.target.files;
              setChosen(list?.length ?? 0);
              if (list?.length) importFiles(list);
            }}
          />
          {chosen > 0 && (
            <p className="text-sm text-muted-foreground">
              {chosen} archivo{chosen === 1 ? "" : "s"} elegido
              {chosen === 1 ? "" : "s"}. {pending ? "Importando…" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => importFiles(fileRef.current?.files ?? null)}
            disabled={pending || !typeReady}
          >
            {pending ? "Importando…" : "Importar DOCX"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                applyResult(await importDequeFolder());
              })
            }
            disabled={pending || !typeReady}
          >
            Cargar carpeta deque/
          </Button>
        </div>
        {summary && (
          <p role="status" className="text-sm text-muted-foreground">
            {summary.file}: {summary.created} creados, {summary.updated}{" "}
            actualizados, {summary.skipped} omitidos
            {summary.queued > 0
              ? `. ${summary.queued} indexaciones en cola.`
              : "."}{" "}
            <Link href="/library/deque" className="underline underline-offset-4">
              Ir a Deque
            </Link>
            {" · "}
            <Link href="/admin/sync" className="underline underline-offset-4">
              Sincronización
            </Link>
            {summary.errors.length > 0
              ? ` Errores: ${summary.errors.slice(0, 3).join(" · ")}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
