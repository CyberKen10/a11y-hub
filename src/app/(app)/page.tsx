import Link from "next/link";
import { ArrowRight, FileWarning, MessageSquare, PlusCircle } from "lucide-react";
import { requireProfile, canEdit } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KnowledgeItemWithType } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: types }, { data: recent }, { data: drafts }] =
    await Promise.all([
      supabase
        .from("knowledge_types")
        .select("id, slug, name, knowledge_items(count)")
        .order("sort_order"),
      supabase
        .from("knowledge_items")
        .select("id, title, status, updated_at, knowledge_types(slug, name, icon)")
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("knowledge_items")
        .select("id, title, updated_at, knowledge_types(slug, name, icon)")
        .eq("status", "draft")
        .eq("owner_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  let failedJobs = 0;
  if (profile.role === "admin") {
    const { count } = await supabase
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    failedJobs = count ?? 0;
  }

  const recentItems = (recent ?? []) as unknown as KnowledgeItemWithType[];
  const draftItems = (drafts ?? []) as unknown as KnowledgeItemWithType[];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {profile.full_name?.split(" ")[0] ?? "equipo"}
          </h1>
          <p className="text-muted-foreground">
            Tu hub de conocimiento de accesibilidad.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/chat">
              <MessageSquare aria-hidden="true" />
              Preguntar al hub
            </Link>
          </Button>
          {canEdit(profile.role) && (
            <Button asChild variant="outline">
              <Link href="/items/new">
                <PlusCircle aria-hidden="true" />
                Nuevo contenido
              </Link>
            </Button>
          )}
        </div>
      </div>

      {failedJobs > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <FileWarning className="size-5 text-destructive" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">
                {failedJobs} sincronización(es) con Google Sheets fallida(s)
              </CardTitle>
              <CardDescription>
                <Link href="/admin/sync" className="underline underline-offset-4">
                  Revisar y reintentar en el panel de sincronización
                </Link>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <section aria-labelledby="apartados-heading" className="space-y-3">
        <h2 id="apartados-heading" className="text-lg font-semibold">
          Apartados
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(types ?? []).map((t) => {
            const count =
              (t.knowledge_items as unknown as { count: number }[])?.[0]
                ?.count ?? 0;
            return (
              <Link
                key={t.slug}
                href={`/library/${t.slug}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t.name}</p>
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} elemento{count === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recientes-heading" className="space-y-3">
          <h2 id="recientes-heading" className="text-lg font-semibold">
            Actualizado recientemente
          </h2>
          <ul className="space-y-2">
            {recentItems.length === 0 && (
              <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aún no hay contenido. Importa tu Google Sheet desde
                Administración o crea el primer elemento.
              </li>
            )}
            {recentItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title}
                  </span>
                  <Badge variant="secondary">
                    {item.knowledge_types?.name ?? "—"}
                  </Badge>
                  {item.status === "draft" && (
                    <Badge variant="outline">Borrador</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="borradores-heading" className="space-y-3">
          <h2 id="borradores-heading" className="text-lg font-semibold">
            Mis borradores
          </h2>
          <ul className="space-y-2">
            {draftItems.length === 0 && (
              <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No tienes borradores pendientes.
              </li>
            )}
            {draftItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title}
                  </span>
                  <Badge variant="secondary">
                    {item.knowledge_types?.name ?? "—"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
