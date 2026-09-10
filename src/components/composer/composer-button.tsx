"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeComposer } from "@/components/composer/knowledge-composer";
import type { KnowledgeType } from "@/lib/types";

/** Header entry point: add knowledge by prompt or voice from anywhere. */
export function ComposerButton({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "icon">[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden="true" />
        <span className="hidden sm:inline">Añadir con IA</span>
        <span className="sr-only sm:hidden">Añadir conocimiento con IA</span>
      </Button>
      <KnowledgeComposer open={open} onOpenChange={setOpen} types={types} />
    </>
  );
}
