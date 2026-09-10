"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { importWikiApproaches, type WikiSeedSummary } from "@/lib/actions/wiki";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WikiApproachesImport() {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<WikiSeedSummary | null>(null);

  function run() {
    startTransition(async () => {
      const result = await importWikiApproaches();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.summary);
      toast.success(
        `Wiki Approaches: ${result.summary.created} nuevos, ${result.summary.updated} actualizados, ${result.summary.skipped} sin cambios.`
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" />
          Wiki Approaches (Excel)
        </CardTitle>
        <CardDescription>
          Carga el archivo <code>docs/Wiki - Approaches .xlsx</code> al
          apartado Approaches. Es idempotente: puedes repetirlo tras editar el
          Excel. No toca las pestañas originales del Google Sheet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? "Cargando wiki…" : "Cargar Wiki Approaches"}
        </Button>
        {summary && (
          <p role="status" className="text-sm text-muted-foreground">
            Archivo {summary.file}: {summary.created} creados, {summary.updated}{" "}
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
