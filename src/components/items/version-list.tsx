"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { restoreVersion } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import type { KnowledgeVersion } from "@/lib/types";

export function VersionList({
  itemId,
  versions,
  canRestore,
}: {
  itemId: string;
  versions: Pick<KnowledgeVersion, "id" | "version" | "title" | "status" | "created_at">[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin versiones registradas.</p>
    );
  }

  return (
    <ol className="space-y-2" aria-label="Historial de versiones">
      {versions.map((v, i) => (
        <li
          key={v.id}
          className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
        >
          <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate">
              <span className="font-medium">v{v.version}</span> · {v.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("es", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(v.created_at))}
            </p>
          </div>
          {canRestore && i !== 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await restoreVersion(itemId, v.id);
                  if (result.ok) {
                    toast.success(`Versión v${v.version} restaurada.`);
                    router.refresh();
                  } else {
                    toast.error(result.error);
                  }
                })
              }
            >
              Restaurar
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
