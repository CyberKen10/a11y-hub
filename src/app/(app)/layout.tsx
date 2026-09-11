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
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
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
    .in("slug", ACTIVE_TYPE_SLUG_LIST)
    .order("sort_order");

  const navTypes = (types ?? []) as Pick<
    KnowledgeType,
    "slug" | "name" | "icon"
  >[];

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col overflow-y-auto bg-sidebar shadow-[8px_0_24px_rgb(27_67_50_/_4%)] md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            aria-hidden="true"
          >
            A
          </span>
          <Link href="/" className="font-heading text-xl font-bold tracking-tight">
            A11y Hub
          </Link>
        </div>
        <NavLinks types={navTypes} role={profile.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 bg-card/90 px-4 py-4 shadow-[0_1px_0_rgb(27_67_50_/_6%)] backdrop-blur md:px-8">
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
