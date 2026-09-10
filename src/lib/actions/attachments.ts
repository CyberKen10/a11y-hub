"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { enqueueAndRun } from "@/lib/sync/jobs";
import type { ActionResult } from "@/lib/actions/items";

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME: Record<string, "pdf" | "docx" | "text"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "text",
  "text/markdown": "text",
};

async function extractText(
  kind: "pdf" | "docx" | "text",
  buffer: Buffer
): Promise<string | null> {
  try {
    if (kind === "text") {
      return buffer.toString("utf-8").slice(0, 200_000);
    }
    if (kind === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text.slice(0, 200_000);
      } finally {
        await parser.destroy();
      }
    }
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, 200_000);
    }
  } catch (error) {
    console.error("[attachments] extraction failed", error);
  }
  return null;
}

export async function uploadAttachment(
  itemId: string,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile("editor");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "El archivo supera el límite de 15 MB." };
  }
  const kind = ALLOWED_MIME[file.type];
  if (!kind) {
    return {
      ok: false,
      error: "Formato no permitido. Se aceptan PDF, DOCX, Markdown y texto.",
    };
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const storagePath = `items/${itemId}/${crypto.randomUUID()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("attachments")
    .upload(storagePath, buffer, { contentType: file.type });
  if (uploadError) {
    return { ok: false, error: `Fallo al subir: ${uploadError.message}` };
  }

  const extractedText = await extractText(kind, buffer);

  const { error: insertError } = await admin.from("attachments").insert({
    item_id: itemId,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    extracted_text: extractedText,
    created_by: profile.id,
  });
  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "attachment.upload",
    entity: "attachments",
    entityId: itemId,
    detail: { file: file.name, size: file.size },
  });

  // Re-index so the extracted text becomes searchable in the chat.
  try {
    await enqueueAndRun("reindex", itemId);
  } catch (error) {
    console.error("[attachments] reindex failed", error);
  }

  revalidatePath(`/items/${itemId}`);
  return { ok: true, id: itemId };
}

export async function deleteAttachment(
  attachmentId: string
): Promise<ActionResult> {
  const profile = await requireProfile("editor");
  const admin = createAdminClient();

  const { data: attachment } = await admin
    .from("attachments")
    .select("id, item_id, storage_path, file_name")
    .eq("id", attachmentId)
    .single();
  if (!attachment) return { ok: false, error: "Adjunto no encontrado." };

  await admin.storage.from("attachments").remove([attachment.storage_path]);
  await admin.from("attachments").delete().eq("id", attachmentId);

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "attachment.delete",
    entity: "attachments",
    entityId: attachment.item_id,
    detail: { file: attachment.file_name },
  });

  try {
    await enqueueAndRun("reindex", attachment.item_id);
  } catch (error) {
    console.error("[attachments] reindex failed", error);
  }

  revalidatePath(`/items/${attachment.item_id}`);
  return { ok: true, id: attachment.item_id };
}
