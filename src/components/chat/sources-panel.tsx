"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetrievedSource } from "@/lib/types";

/** Citations used by an assistant answer, linked to the source items. */
export function SourcesPanel({ sources }: { sources: RetrievedSource[] }) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Fuentes utilizadas ({sources.length})
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol className="space-y-2 border-t px-3 py-2">
          {sources.map((s) => (
            <li key={`${s.index}-${s.item_id}`} className="text-sm">
              <p>
                <span
                  className="mr-1 inline-flex size-5 items-center justify-center rounded bg-primary/10 text-xs font-semibold"
                  aria-hidden="true"
                >
                  {s.index}
                </span>
                <Link
                  href={`/items/${s.item_id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {s.item_title}
                </Link>
                {s.heading && (
                  <span className="text-muted-foreground"> — {s.heading}</span>
                )}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {s.snippet}
              </p>
              {s.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Actualizado{" "}
                  {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
                    new Date(s.updated_at)
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
