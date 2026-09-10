"use server";

import path from "node:path";
import { pathToFileURL } from "node:url";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { ImportSummary } from "@/lib/actions/sheets";

export type WikiSeedSummary = ImportSummary & {
  file: string;
  queued: number;
};

async function loadSeedModule(): Promise<{
  seedApproachWiki: (
    supabase: ReturnType<typeof createAdminClient>,
    options: {
      ownerId: string | null;
      enqueueReindex: boolean;
      enqueueMirror: boolean;
    }
  ) => Promise<WikiSeedSummary>;
  dedupePendingReindex: (
    supabase: ReturnType<typeof createAdminClient>
  ) => Promise<number>;
}> {
  const href = pathToFileURL(
    path.join(process.cwd(), "scripts", "seed-approaches.mjs")
  ).href;
  return import(href);
}

/** Loads docs/Wiki - Approaches .xlsx into the Approaches knowledge type. */
export async function importWikiApproaches(): Promise<
  { ok: true; summary: WikiSeedSummary } | { ok: false; error: string }
> {
  const profile = await requireProfile("admin");

  try {
    const { seedApproachWiki, dedupePendingReindex } = await loadSeedModule();
    const admin = createAdminClient();
    const summary = await seedApproachWiki(admin, {
      ownerId: profile.id,
      enqueueReindex: true,
      enqueueMirror: false,
    });
    await dedupePendingReindex(admin);

    await audit({
      actorId: profile.id,
      actorEmail: profile.email,
      action: "wiki.approaches.import",
      entity: "knowledge_items",
      detail: { ...summary },
    });

    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
