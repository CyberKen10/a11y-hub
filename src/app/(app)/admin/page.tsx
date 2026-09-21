import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileClock,
  RefreshCcw,
  Sheet,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administración" };

const GROUPS: {
  id: string;
  title: string;
  items: {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
  }[];
}[] = [
  {
    id: "contenido",
    title: "Contenido",
    items: [
      {
        href: "/admin/import",
        icon: Sheet,
        title: "Importar conocimiento",
        description:
          "Carga un Excel, Deque o un Google Sheet.",
      },
      {
        href: "/admin/sync",
        icon: RefreshCcw,
        title: "Sincronización",
        description:
          "Indexación del chat y reintentos.",
      },
    ],
  },
  {
    id: "equipo",
    title: "Equipo",
    items: [
      {
        href: "/admin/users",
        icon: Users,
        title: "Usuarios y roles",
        description: "Quién puede leer, editar o administrar.",
      },
      {
        href: "/admin/audit",
        icon: FileClock,
        title: "Auditoría",
        description: "Quién hizo qué y cuándo.",
      },
    ],
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
      .eq("status", "failed")
      .eq("kind", "reindex"),
  ]);

  const failedCount = failed.count ?? 0;
  const stats = [
    {
      label: "Elementos",
      value: items.count ?? 0,
      href: "/library",
      alert: false,
    },
    {
      label: "Usuarios",
      value: users.count ?? 0,
      href: "/admin/users",
      alert: false,
    },
    {
      label: "Indexaciones fallidas",
      value: failedCount,
      href: "/admin/sync",
      alert: failedCount > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <div>
        <h1 className="tracking-tight">Administración</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-lg">
          Importar, sincronizar y gestionar el equipo.
        </p>
      </div>

      <section aria-labelledby="resumen-heading" className="space-y-4">
        <h2 id="resumen-heading" className="font-bold">
          Resumen
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={
                stat.alert
                  ? "rounded-2xl bg-card p-4 text-left text-card-foreground shadow-[0_8px_28px_rgb(27_67_50_/_6%)] ring-1 ring-destructive/40 md:p-5"
                  : "rounded-2xl bg-card p-4 text-left text-card-foreground shadow-[0_8px_28px_rgb(27_67_50_/_6%)] md:p-5"
              }
            >
              <p
                className={
                  stat.alert
                    ? "font-heading text-3xl font-bold tracking-tight text-destructive"
                    : "font-heading text-3xl font-bold tracking-tight"
                }
              >
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {GROUPS.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="space-y-4"
        >
          <h2 id={`${group.id}-heading`} className="font-bold">
            {group.title}
          </h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              const syncAlert =
                item.href === "/admin/sync" && failedCount > 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-start gap-4 rounded-2xl bg-card p-4 text-left text-card-foreground shadow-[0_8px_28px_rgb(27_67_50_/_6%)] transition-shadow hover:shadow-[0_12px_32px_rgb(27_67_50_/_10%)] focus-visible:outline-2 focus-visible:outline-ring md:p-5"
                  >
                    <span
                      className={
                        syncAlert
                          ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
                          : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"
                      }
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-heading text-lg font-bold tracking-tight">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
