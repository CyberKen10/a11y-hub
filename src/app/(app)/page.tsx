import Link from "next/link";
import {
  Compass,
  FileText,
  FileWarning,
  MessageSquare,
  PlusCircle,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import type { KnowledgeItemWithType } from "@/lib/types";

const TYPE_ICONS: Record<string, LucideIcon> = {
  approaches: Compass,
  metodologias: Workflow,
  herramientas: Wrench,
  plantillas: FileText,
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: types }, { data: recent }, { data: drafts }] =
    await Promise.all([
      supabase
        .from("knowledge_types")
        .select("id, slug, name, knowledge_items(count)")
        .in("slug", ACTIVE_TYPE_SLUG_LIST)
        .order("sort_order"),
      supabase
        .from("knowledge_items")
        .select("id, title, status, updated_at, knowledge_types!inner(slug, name, icon)")
        .in("knowledge_types.slug", ACTIVE_TYPE_SLUG_LIST)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("knowledge_items")
        .select("id, title, updated_at, knowledge_types!inner(slug, name, icon)")
        .in("knowledge_types.slug", ACTIVE_TYPE_SLUG_LIST)
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
          <h1 className="tracking-tight">
            Hola de nuevo, {profile.full_name?.split(" ")[0] ?? "equipo"}
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            Aquí está tu hub de conocimiento de accesibilidad.
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

      <section aria-labelledby="apartados-heading" className="space-y-4">
        <h2 id="apartados-heading" className="font-bold">
          Apartados
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(types ?? []).map((t) => {
            const count =
              (t.knowledge_items as unknown as { count: number }[])?.[0]
                ?.count ?? 0;
            const Icon = TYPE_ICONS[t.slug] ?? FileText;
            return (
              <Link
                key={t.slug}
                href={`/library/${t.slug}`}
                className="group rounded-2xl bg-card p-5 shadow-[0_8px_28px_rgb(27_67_50_/_6%)] transition-shadow hover:shadow-[0_12px_32px_rgb(27_67_50_/_10%)] focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-5 font-heading text-4xl font-bold tracking-tight">
                  {count}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.name}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="recientes-heading"
          className="rounded-2xl bg-card p-5 shadow-[0_8px_28px_rgb(27_67_50_/_6%)]"
        >
          <h2 id="recientes-heading" className="font-bold">
            Actualizado recientemente
          </h2>
          <ul className="mt-4 space-y-1">
            {recentItems.length === 0 && (
              <li className="rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
                Aún no hay contenido. Importa tu Google Sheet desde
                Administración o crea el primer elemento.
              </li>
            )}
            {recentItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary"
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

        <section
          aria-labelledby="borradores-heading"
          className="rounded-2xl bg-card p-5 shadow-[0_8px_28px_rgb(27_67_50_/_6%)]"
        >
          <h2 id="borradores-heading" className="font-bold">
            Mis borradores
          </h2>
          <ul className="mt-4 space-y-1">
            {draftItems.length === 0 && (
              <li className="rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
                No tienes borradores pendientes.
              </li>
            )}
            {draftItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary"
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
