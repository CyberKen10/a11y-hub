"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Home, LibraryBig, MessageSquare, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ACTIVE_TYPE_SLUG_LIST } from "@/lib/knowledge-sections";
import type { KnowledgeType } from "@/lib/types";

interface SearchHit {
  id: string;
  title: string;
  type_name: string | null;
}

export function CommandMenu({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name">[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const supabase = createClient();
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("knowledge_items")
        .select("id, title, knowledge_types!inner(name, slug)")
        .in("knowledge_types.slug", ACTIVE_TYPE_SLUG_LIST)
        .ilike("title", `%${query.trim()}%`)
        .neq("status", "archived")
        .limit(8);
      setHits(
        (data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          type_name:
            (row.knowledge_types as unknown as { name: string } | null)?.name ??
            null,
        }))
      );
    }, 250);
    return () => clearTimeout(handle);
  }, [open, query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <Button
        variant="outline"
        className="min-w-0 flex-1 justify-start gap-2 rounded-full border-transparent bg-secondary px-2.5 text-muted-foreground sm:max-w-xs sm:flex-none sm:px-3 md:w-72"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="truncate">
          <span className="sm:hidden">Buscar…</span>
          <span className="hidden sm:inline">Buscar en el hub…</span>
        </span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline-block">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar"
        description="Busca contenido o navega por el hub"
      >
        <CommandInput
          placeholder="Buscar contenido o navegar…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          {hits.length > 0 && (
            <CommandGroup heading="Contenido">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`${hit.title} ${hit.id}`}
                  onSelect={() => go(`/items/${hit.id}`)}
                >
                  <span className="truncate">{hit.title}</span>
                  {hit.type_name && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {hit.type_name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Navegación">
            <CommandItem onSelect={() => go("/")}>
              <Home aria-hidden="true" /> Inicio
            </CommandItem>
            <CommandItem onSelect={() => go("/chat")}>
              <MessageSquare aria-hidden="true" /> Chat con la información
            </CommandItem>
            <CommandItem onSelect={() => go("/library")}>
              <LibraryBig aria-hidden="true" /> Toda la biblioteca
            </CommandItem>
            {types.map((t) => (
              <CommandItem key={t.slug} onSelect={() => go(`/library/${t.slug}`)}>
                <LibraryBig aria-hidden="true" /> {t.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
