"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ImportSummary } from "@/lib/import/types";
import { importFromSheetUrl } from "@/lib/actions/sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ImportWizard() {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  function startImport() {
    if (!url.trim()) {
      toast.error("Pega el enlace del Google Sheet.");
      return;
    }
    startTransition(async () => {
      const result = await importFromSheetUrl(url);
      if (result.ok) {
        setSummary(result.summary);
        toast.success(
          `Importación completa: ${result.summary.created} creados, ${result.summary.updated} actualizados, ${result.summary.skipped} sin cambios.`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar Google Sheet</CardTitle>
        <CardDescription>
          Pega el enlace. Se leen todas las pestañas, se elige el apartado según
          el nombre y se agregan las filas. Comparte el Sheet con la cuenta de
          servicio como Lector.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sheet-url">Enlace del Sheet</Label>
          <Input
            id="sheet-url"
            type="url"
            inputMode="url"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <Button onClick={startImport} disabled={pending}>
          {pending ? "Importando…" : "Importar Sheet"}
        </Button>
        {summary && (
          <div role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              <strong>{summary.created}</strong> creados ·{" "}
              <strong>{summary.updated}</strong> actualizados ·{" "}
              <strong>{summary.skipped}</strong> sin cambios
            </p>
            {summary.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium text-destructive">
                  {summary.errors.length} errores
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {summary.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-2 text-muted-foreground">
              La indexación del chat se procesa en{" "}
              <a href="/admin/sync" className="underline underline-offset-4">
                Sincronización
              </a>
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
