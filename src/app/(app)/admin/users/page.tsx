import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireProfile("admin");
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  const profiles = (data ?? []) as Profile[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="tracking-tight">
          Usuarios y roles
        </h1>
        <p className="text-muted-foreground">
          Las cuentas se crean en Supabase (Authentication → Users → Add user).
          Aquí solo cambias el rol. Lector: consulta y chatea. Editor: crea y
          edita contenido. Administrador: gestiona todo.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead>Rol</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.full_name ?? "—"}
                  {p.id === me.id && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (tú)
                    </span>
                  )}
                </TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
                    new Date(p.created_at)
                  )}
                </TableCell>
                <TableCell>
                  <UserRoleSelect
                    userId={p.id}
                    userEmail={p.email}
                    role={p.role}
                    disabled={p.id === me.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
