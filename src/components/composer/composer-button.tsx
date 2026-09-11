"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeComposer } from "@/components/composer/knowledge-composer";
import type { KnowledgeType } from "@/lib/types";

/** Header: add knowledge from anywhere. */
export function ComposerButton({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "icon" | "fields">[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        <span className="hidden sm:inline">Añadir</span>
        <span className="sr-only sm:hidden">Añadir contenido</span>
      </Button>
      <KnowledgeComposer open={open} onOpenChange={setOpen} types={types} />
    </>
  );
}
