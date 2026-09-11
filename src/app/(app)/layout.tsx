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
import { BrandLogo } from "@/components/shell/brand-logo";
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
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col overflow-y-auto bg-sidebar shadow-[8px_0_24px_rgb(27_67_50_/_4%)] md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-heading text-xl font-bold tracking-tight"
          >
            <BrandLogo size={40} />
            A11y Hub
          </Link>
        </div>
        <NavLinks types={navTypes} role={profile.role} />
      </aside>

      <div className="flex h-svh min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-1.5 bg-card/90 px-2 py-2.5 shadow-[0_1px_0_rgb(27_67_50_/_6%)] backdrop-blur md:gap-2 md:px-8 md:py-4">
          <MobileNav types={navTypes} role={profile.role} />
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-heading text-base font-bold tracking-tight md:hidden"
          >
            <BrandLogo size={28} />
            <span className="max-[380px]:sr-only">A11y Hub</span>
          </Link>
          <CommandMenu types={navTypes} />
          <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
            {canEdit(profile.role) && <ComposerButton types={navTypes} />}
            <ThemeToggle />
            <UserMenu profile={profile} />
          </div>
        </header>
        <main
          id="contenido"
          className="mx-2 mb-0 mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-t-[1.25rem] rounded-b-none bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-[0_8px_28px_rgb(27_67_50_/_12%)] md:mx-6 md:mt-4 md:rounded-t-[2rem] md:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
