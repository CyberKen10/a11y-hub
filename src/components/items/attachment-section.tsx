"use client";

import { useRef, useTransition } from "react";
import { Paperclip, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAttachment,
  uploadAttachment,
} from "@/lib/actions/attachments";
import { Button } from "@/components/ui/button";

export interface AttachmentView {
  id: string;
  file_name: string;
  size_bytes: number;
  signedUrl: string | null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AttachmentSection({
  itemId,
  attachments,
  canEdit,
}: {
  itemId: string;
  attachments: AttachmentView[];
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFileSelected(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadAttachment(itemId, formData);
      if (result.ok) {
        toast.success("Adjunto subido y texto extraído para la búsqueda.");
      } else {
        toast.error(result.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <section aria-labelledby="adjuntos-heading" className="space-y-3">
      <h2 id="adjuntos-heading" className="text-lg font-semibold">
        Adjuntos
      </h2>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin adjuntos.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <Paperclip
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{att.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatSize(att.size_bytes)}
              </span>
              {att.signedUrl && (
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={att.signedUrl}
                    download={att.file_name}
                    aria-label={`Descargar ${att.file_name}`}
                  >
                    <Download aria-hidden="true" />
                  </a>
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Eliminar ${att.file_name}`}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteAttachment(att.id);
                      if (result.ok) toast.success("Adjunto eliminado.");
                      else toast.error(result.error);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            id="attachment-input"
            accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            onChange={(e) => onFileSelected(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip aria-hidden="true" />
            {pending ? "Subiendo…" : "Subir adjunto (PDF, DOCX, MD, TXT)"}
          </Button>
        </div>
      )}
    </section>
  );
}
