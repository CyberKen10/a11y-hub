import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/shell/nav-links";
import { MobileNav } from "@/components/shell/mobile-nav";
import { CommandMenu } from "@/components/shell/command-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { ComposerButton } from "@/components/composer/composer-button";
import { canEdit } from "@/lib/auth";
import type { KnowledgeType } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("knowledge_types")
    .select("slug, name, icon")
    .order("sort_order");

  const navTypes = (types ?? []) as Pick<
    KnowledgeType,
    "slug" | "name" | "icon"
  >[];

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-y-auto border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
            aria-hidden="true"
          >
            A
          </span>
          <Link href="/" className="font-semibold tracking-tight">
            A11y Hub
          </Link>
        </div>
        <NavLinks types={navTypes} role={profile.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <MobileNav types={navTypes} role={profile.role} />
          <CommandMenu types={navTypes} />
          <div className="ml-auto flex items-center gap-1">
            {canEdit(profile.role) && <ComposerButton types={navTypes} />}
            <ThemeToggle />
            <UserMenu profile={profile} />
          </div>
        </header>
        <main id="contenido" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
