"use server";

import path from "node:path";
import { pathToFileURL } from "node:url";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { runPendingJobs } from "@/lib/sync/jobs";
import type { WikiSeedSummary } from "@/lib/import/types";

const MAX_DOCX_BYTES = 20 * 1024 * 1024;

async function loadDequeModules(): Promise<{
  loadDequeItemsFromFolder: (
    cwd?: string
  ) => Promise<{ file: string; items: unknown[] }>;
  loadDequeItemsFromBuffers: (
    files: { fileName: string; buffer: Buffer }[]
  ) => Promise<{ file: string; items: unknown[] }>;
  seedDeque: (
    supabase: ReturnType<typeof createAdminClient>,
    options: {
      ownerId: string | null;
      enqueueReindex: boolean;
      items?: unknown[];
    }
  ) => Promise<WikiSeedSummary>;
  dedupePendingReindex: (
    supabase: ReturnType<typeof createAdminClient>
  ) => Promise<number>;
}> {
  const parse = await import(
    pathToFileURL(path.join(process.cwd(), "scripts", "parse-deque.mjs")).href
  );
  const seed = await import(
    pathToFileURL(path.join(process.cwd(), "scripts", "seed-deque.mjs")).href
  );
  return { ...parse, ...seed };
}

async function finishImport(
  profile: { id: string; email: string },
  summary: WikiSeedSummary
): Promise<{ ok: true; summary: WikiSeedSummary } | { ok: false; error: string }> {
  if (summary.errors.length > 0 && summary.created + summary.updated === 0) {
    return {
      ok: false,
      error: summary.errors[0] ?? "No se pudo importar Deque.",
    };
  }
  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "deque.import",
    entity: "knowledge_items",
    detail: { ...summary },
  });
  try {
    await runPendingJobs();
  } catch (error) {
    console.error("[deque-import] job batch failed", error);
  }
  revalidatePath("/", "layout");
  return { ok: true, summary };
}

export async function importDequeFolder(): Promise<
  { ok: true; summary: WikiSeedSummary } | { ok: false; error: string }
> {
  const profile = await requireProfile("admin");
  try {
    const { loadDequeItemsFromFolder, seedDeque, dedupePendingReindex } =
      await loadDequeModules();
    const admin = createAdminClient();
    const parsed = await loadDequeItemsFromFolder(process.cwd());
    if (parsed.items.length === 0) {
      return {
        ok: false,
        error:
          "No hay DOCX en la carpeta deque/ o no encontré criterios WCAG.",
      };
    }
    const seeded = await seedDeque(admin, {
      ownerId: profile.id,
      enqueueReindex: true,
      items: parsed.items,
    });
    await dedupePendingReindex(admin);
    return finishImport(profile, { ...seeded, file: parsed.file });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function importDequeUpload(
  formData: FormData
): Promise<{ ok: true; summary: WikiSeedSummary } | { ok: false; error: string }> {
  const profile = await requireProfile("admin");
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File);
  if (files.length === 0) {
    return { ok: false, error: "Selecciona uno o más archivos .docx." };
  }
  for (const file of files) {
    if (file.size > MAX_DOCX_BYTES) {
      return { ok: false, error: `${file.name} supera el límite de 20 MB.` };
    }
    if (!/\.(docx|md|txt)$/i.test(file.name)) {
      return { ok: false, error: "Sube archivos .docx (o .md / .txt)." };
    }
  }

  try {
    const { loadDequeItemsFromBuffers, seedDeque, dedupePendingReindex } =
      await loadDequeModules();
    const admin = createAdminClient();
    const parsed = await loadDequeItemsFromBuffers(
      await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          buffer: Buffer.from(await file.arrayBuffer()),
        }))
      )
    );
    if (parsed.items.length === 0) {
      return {
        ok: false,
        error: "Esos documentos no tienen criterios WCAG para importar.",
      };
    }
    const seeded = await seedDeque(admin, {
      ownerId: profile.id,
      enqueueReindex: true,
      items: parsed.items,
    });
    await dedupePendingReindex(admin);
    return finishImport(profile, { ...seeded, file: parsed.file });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
