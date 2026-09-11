"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingNotesComposer } from "@/components/composer/meeting-notes-composer";
import type { KnowledgeType } from "@/lib/types";

export function MeetingNotesButton({
  types,
}: {
  types: Pick<KnowledgeType, "slug" | "name" | "icon" | "fields">[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <NotebookPen aria-hidden="true" />
        <span className="hidden sm:inline">Acuerdos</span>
        <span className="sr-only sm:hidden">Acuerdos de reunión</span>
      </Button>
      <MeetingNotesComposer open={open} onOpenChange={setOpen} types={types} />
    </>
  );
}
