"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCcw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { processPendingJobs, retryJob } from "@/lib/actions/sheets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SyncJob } from "@/lib/types";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  done: "secondary",
  pending: "outline",
  running: "default",
  failed: "destructive",
};

const KIND_LABEL: Record<string, string> = {
  sheet_mirror: "Espejo en Sheets",
  reindex: "Indexación RAG",
};

export function SyncPanel({
  jobs,
}: {
  jobs: (SyncJob & { item_title: string | null })[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await processPendingJobs();
            toast.success(`Lote procesado: ${result.processed} trabajos.`);
            router.refresh();
          })
        }
      >
        <RefreshCcw aria-hidden="true" />
        {pending ? "Procesando…" : "Procesar pendientes (lotes de 25)"}
      </Button>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajo</TableHead>
              <TableHead>Elemento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Intentos</TableHead>
              <TableHead>Último error</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No hay trabajos de sincronización.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{KIND_LABEL[job.kind] ?? job.kind}</TableCell>
                <TableCell className="max-w-56 truncate">
                  {job.item_title ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell>{job.attempts}</TableCell>
                <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                  {job.last_error ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("es", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(job.updated_at))}
                </TableCell>
                <TableCell>
                  {(job.status === "failed" || job.status === "pending") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await retryJob(job.id);
                          toast.info(`Resultado: ${result.status}`);
                          router.refresh();
                        })
                      }
                    >
                      <RotateCw aria-hidden="true" />
                      Reintentar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
