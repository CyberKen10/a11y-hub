"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  fetchTabs,
  previewTab,
  runImport,
  type ImportSummary,
} from "@/lib/actions/sheets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { KnowledgeType } from "@/lib/types";

const NONE = "__none__";

interface RawRow {
  rowNumber: number;
  values: string[];
}

export function ImportWizard({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name">[];
}) {
  const [pending, startTransition] = useTransition();

  const [tabs, setTabs] = useState<string[] | null>(null);
  const [tab, setTab] = useState("");
  const [sampleRows, setSampleRows] = useState<RawRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);

  const [titleCol, setTitleCol] = useState("");
  const [summaryCol, setSummaryCol] = useState(NONE);
  const [contentCol, setContentCol] = useState(NONE);
  const [tagsCol, setTagsCol] = useState(NONE);
  const [typeSlug, setTypeSlug] = useState(types[0]?.slug ?? "");
  const [publish, setPublish] = useState(true);

  const [summary, setSummary] = useState<ImportSummary | null>(null);

  /** Headers derived from the selected header row. */
  const headers = useMemo(() => {
    const row = sampleRows.find((r) => r.rowNumber === headerRow);
    return (row?.values ?? []).map((h) => h.trim()).filter(Boolean);
  }, [sampleRows, headerRow]);

  function loadTabs() {
    startTransition(async () => {
      const result = await fetchTabs();
      if (result.ok) {
        setTabs(result.tabs);
        if (result.tabs.length > 0) toast.success("Conectado al Sheet.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function loadPreview(selected: string) {
    setTab(selected);
    setSummary(null);
    startTransition(async () => {
      const result = await previewTab(selected);
      if (result.ok) {
        setSampleRows(result.sampleRows);
        setTotalRows(result.totalRows);
        // Heuristic: pick the first row where most cells are non-empty.
        const best = result.sampleRows.find(
          (r) => r.values.filter(Boolean).length >= 3
        );
        setHeaderRow(best?.rowNumber ?? 1);
        setTitleCol("");
        setSummaryCol(NONE);
        setContentCol(NONE);
        setTagsCol(NONE);
      } else {
        toast.error(result.error);
      }
    });
  }

  function startImport() {
    if (!tab || !titleCol) {
      toast.error("Selecciona la pestaña y la columna de título.");
      return;
    }
    startTransition(async () => {
      const result = await runImport({
        tab,
        typeSlug,
        publish,
        headerRow,
        mapping: {
          title: titleCol,
          summary: summaryCol === NONE ? undefined : summaryCol,
          content: contentCol === NONE ? undefined : contentCol,
          tags: tagsCol === NONE ? undefined : tagsCol,
        },
      });
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

  const columnSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    required = false
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Selecciona columna" />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>— No usar —</SelectItem>}
          {headers.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Paso 1: conectar */}
      <section aria-labelledby="paso1" className="space-y-3">
        <h2 id="paso1" className="font-bold">
          1. Conectar con el Sheet
        </h2>
        {tabs === null ? (
          <Button onClick={loadTabs} disabled={pending}>
            {pending ? "Conectando…" : "Conectar y listar pestañas"}
          </Button>
        ) : (
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="import-tab">Pestaña a importar</Label>
            <Select value={tab} onValueChange={loadPreview}>
              <SelectTrigger id="import-tab">
                <SelectValue placeholder="Selecciona una pestaña" />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* Paso 2: fila de encabezados + previsualización */}
      {sampleRows.length > 0 && (
        <section aria-labelledby="paso2" className="space-y-4">
          <h2 id="paso2" className="font-bold">
            2. Indicar la fila de encabezados y revisar
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalRows} filas detectadas. Si tu pestaña tiene un banner o
            título encima de la tabla, elige la fila donde están los nombres de
            las columnas; todo lo anterior se ignora.
          </p>

          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="import-header-row">Fila de encabezados</Label>
            <Select
              value={String(headerRow)}
              onValueChange={(v) => setHeaderRow(Number(v))}
            >
              <SelectTrigger id="import-header-row">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sampleRows.map((r) => (
                  <SelectItem key={r.rowNumber} value={String(r.rowNumber)}>
                    Fila {r.rowNumber}:{" "}
                    {r.values.filter(Boolean).slice(0, 4).join(" · ").slice(0, 60) ||
                      "(vacía)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  {(sampleRows[0]?.values ?? []).map((_, j) => (
                    <TableHead key={j}>
                      {headers[j] ?? `Col ${j + 1}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleRows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={
                      row.rowNumber === headerRow ? "bg-primary/10" : undefined
                    }
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {row.rowNumber}
                      {row.rowNumber === headerRow && (
                        <span className="sr-only"> (fila de encabezados)</span>
                      )}
                    </TableCell>
                    {(sampleRows[0]?.values ?? []).map((_, j) => (
                      <TableCell key={j} className="max-w-56 truncate">
                        {row.values[j] ?? ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Paso 3: mapear columnas */}
      {headers.length > 0 && (
        <section aria-labelledby="paso3" className="space-y-4">
          <h2 id="paso3" className="font-bold">
            3. Mapear columnas
          </h2>
          <p className="text-sm text-muted-foreground">
            Las columnas sin mapear se conservan como campos adicionales del
            elemento (y también se indexan para el chat).
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {columnSelect("map-title", "Título (obligatorio)", titleCol, setTitleCol, true)}
            {columnSelect("map-summary", "Resumen", summaryCol, setSummaryCol)}
            {columnSelect("map-content", "Contenido", contentCol, setContentCol)}
            {columnSelect("map-tags", "Tags", tagsCol, setTagsCol)}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-type">Apartado de destino</Label>
              <Select value={typeSlug} onValueChange={setTypeSlug}>
                <SelectTrigger id="import-type">
                  <SelectValue />
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
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="import-publish"
                checked={publish}
                onCheckedChange={(v) => setPublish(v === true)}
              />
              <Label htmlFor="import-publish">
                Publicar directamente (indexa para el chat)
              </Label>
            </div>
          </div>
        </section>
      )}

      {/* Paso 4: ejecutar */}
      {headers.length > 0 && (
        <section aria-labelledby="paso4" className="space-y-3">
          <h2 id="paso4" className="font-bold">
            4. Ejecutar importación
          </h2>
          <p className="text-sm text-muted-foreground">
            La importación es idempotente: puedes repetirla y solo se procesan
            filas nuevas o modificadas. Las filas sin título (p. ej. separadores
            de sección) se omiten.
          </p>
          <Button onClick={startImport} disabled={pending || !titleCol}>
            {pending ? "Importando…" : `Importar ${Math.max(0, totalRows - headerRow)} filas`}
          </Button>

          {summary && (
            <div
              role="status"
              className="rounded-lg border bg-muted/40 p-4 text-sm"
            >
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
                    {summary.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="mt-2 text-muted-foreground">
                La indexación y el espejo se procesan por lotes en{" "}
                <a href="/admin/sync" className="underline underline-offset-4">
                  el panel de sincronización
                </a>
                .
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
