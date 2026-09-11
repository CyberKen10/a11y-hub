import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog } from "@/lib/types";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage() {
  await requireProfile("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const logs = (data ?? []) as AuditLog[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Últimas 200 acciones registradas en la plataforma.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Sin registros todavía.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("es", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  }).format(new Date(log.created_at))}
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">
                  {log.actor_email ?? "sistema"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{log.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">{log.entity}</TableCell>
                <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                  {JSON.stringify(log.detail)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
