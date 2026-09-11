"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Compass,
  FileText,
  FlaskConical,
  Home,
  Library,
  LibraryBig,
  MessageSquare,
  Puzzle,
  Scale,
  ShieldCheck,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeType, UserRole } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  workflow: Workflow,
  scale: Scale,
  puzzle: Puzzle,
  wrench: Wrench,
  briefcase: Briefcase,
  "flask-conical": FlaskConical,
  "file-text": FileText,
  "book-open": BookOpen,
  library: Library,
};

function NavLink({
  href,
  label,
  icon: Icon,
  exact = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-base transition-colors",
        active
          ? "bg-sidebar-accent font-bold text-primary"
          : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function NavLinks({
  types,
  role,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "icon">[];
  role: UserRole;
}) {
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-8 px-4 pb-6">
      <div className="flex flex-col gap-1">
        <NavLink href="/" label="Inicio" icon={Home} exact />
        <NavLink href="/chat" label="Chat con la información" icon={MessageSquare} />
        <NavLink href="/library" label="Toda la biblioteca" icon={LibraryBig} exact />
      </div>

      <div>
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Apartados
        </p>
        <div className="flex flex-col gap-1">
          {types.map((t) => (
            <NavLink
              key={t.slug}
              href={`/library/${t.slug}`}
              label={t.name}
              icon={ICONS[t.icon ?? ""] ?? Library}
            />
          ))}
        </div>
      </div>

      {role === "admin" && (
        <div>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Gestión
          </p>
          <div className="flex flex-col gap-1">
            <NavLink href="/admin" label="Administración" icon={ShieldCheck} />
          </div>
        </div>
      )}
    </nav>
  );
}
