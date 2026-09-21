"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import {
  importDequeFolder,
  importDequeUpload,
} from "@/lib/actions/deque";
import type { WikiSeedSummary } from "@/lib/import/types";
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

export function DequeImport() {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<WikiSeedSummary | null>(null);
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
      `${result.summary.file}: ${result.summary.created} nuevos, ${result.summary.updated} actualizados, ${result.summary.skipped} sin cambios.`
    );
  }

  function loadFolder() {
    startTransition(async () => {
      applyResult(await importDequeFolder());
    });
  }

  function upload() {
    const list = fileRef.current?.files;
    if (!list?.length) {
      toast.error("Selecciona uno o más .docx de tu PC.");
      return;
    }
    const formData = new FormData();
    for (const file of Array.from(list)) formData.append("files", file);
    startTransition(async () => {
      applyResult(await importDequeUpload(formData));
      if (fileRef.current) fileRef.current.value = "";
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
          Cada DOCX se parte por criterio WCAG. Las variantes (1.3.1.a y
          1.3.1.b) quedan en la misma ficha, con su metodología de testeo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="deque-files">Archivos .docx</Label>
          <Input
            ref={fileRef}
            id="deque-files"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={upload} disabled={pending}>
            {pending ? "Cargando…" : "Subir DOCX"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadFolder}
            disabled={pending}
          >
            Cargar carpeta deque/
          </Button>
        </div>
        {summary && (
          <p role="status" className="text-sm text-muted-foreground">
            {summary.file}: {summary.created} creados, {summary.updated}{" "}
            actualizados, {summary.skipped} omitidos
            {summary.queued > 0
              ? `. ${summary.queued} indexaciones en cola (Sincronización).`
              : "."}
            {summary.errors.length > 0
              ? ` Errores: ${summary.errors.slice(0, 3).join(" · ")}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
