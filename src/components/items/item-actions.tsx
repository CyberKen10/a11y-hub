"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, CheckCircle2, Pencil, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteItem, setItemStatus } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ItemStatus } from "@/lib/types";

export function ItemActions({
  itemId,
  status,
  isAdmin,
}: {
  itemId: string;
  status: ItemStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function changeStatus(next: ItemStatus, successMessage: string) {
    startTransition(async () => {
      const result = await setItemStatus(itemId, next);
      if (result.ok) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/items/${itemId}/edit`}>
          <Pencil aria-hidden="true" />
          Editar
        </Link>
      </Button>

      {status !== "published" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            changeStatus(
              "published",
              "Publicado: indexado para el chat y espejado en Sheets."
            )
          }
        >
          <CheckCircle2 aria-hidden="true" />
          Publicar
        </Button>
      )}

      {status === "published" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => changeStatus("draft", "Movido a borrador.")}
        >
          <Undo2 aria-hidden="true" />
          Pasar a borrador
        </Button>
      )}

      {status !== "archived" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => changeStatus("archived", "Elemento archivado.")}
        >
          <Archive aria-hidden="true" />
          Archivar
        </Button>
      )}

      {isAdmin && (
        <>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden="true" />
            Eliminar
          </Button>
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Eliminar este elemento?</DialogTitle>
                <DialogDescription>
                  Esta acción es permanente: se borran sus versiones, chunks y
                  relaciones. La fila del Sheet no se elimina automáticamente.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteItem(itemId);
                      if (result.ok) {
                        toast.success("Elemento eliminado.");
                        router.push("/library");
                      } else {
                        toast.error(result.error);
                      }
                    })
                  }
                >
                  Eliminar definitivamente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
