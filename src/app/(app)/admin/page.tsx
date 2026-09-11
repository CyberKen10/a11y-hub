import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileClock,
  RefreshCcw,
  Sheet,
  Users,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Administración" };

const SECTIONS = [
  {
    href: "/admin/import",
    icon: Sheet,
    title: "Importar conocimiento",
    description: "Carga el Excel Wiki Approaches o una pestaña de Google Sheets.",
  },
  {
    href: "/admin/sync",
    icon: RefreshCcw,
    title: "Sincronización",
    description: "Estado del índice RAG y del espejo en Sheets; reintentos.",
  },
  {
    href: "/admin/users",
    icon: Users,
    title: "Usuarios y roles",
    description: "Gestiona quién puede leer, editar o administrar.",
  },
  {
    href: "/admin/audit",
    icon: FileClock,
    title: "Auditoría",
    description: "Registro de acciones: quién hizo qué y cuándo.",
  },
];

export default async function AdminPage() {
  await requireProfile("admin");
  const supabase = await createClient();

  const [items, users, failed] = await Promise.all([
    supabase.from("knowledge_items").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="tracking-tight">Administración</h1>
        <p className="text-muted-foreground">
          {items.count ?? 0} elementos · {users.count ?? 0} usuarios ·{" "}
          {failed.count ?? 0} sincronizaciones fallidas
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-accent">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <section.icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
