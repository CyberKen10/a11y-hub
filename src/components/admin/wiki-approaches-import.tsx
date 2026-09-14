"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import type { WikiSeedSummary } from "@/lib/import/types";
import { importExcelUpload } from "@/lib/actions/wiki";
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

export function WikiApproachesImport() {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<WikiSeedSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function run() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un Excel de tu PC.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await importExcelUpload(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.summary);
      toast.success(
        `${result.summary.file}: ${result.summary.created} nuevos, ${result.summary.updated} actualizados, ${result.summary.skipped} sin cambios.`
      );
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" />
          Cargar Excel
        </CardTitle>
        <CardDescription>
          Sube un .xlsx desde tu PC. Si es la Wiki Approaches, entra en
          Approaches; si no, cada pestaña se clasifica sola.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="excel-file">Archivo</Label>
          <Input
            ref={fileRef}
            id="excel-file"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
        </div>
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? "Cargando…" : "Cargar Excel"}
        </Button>
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
