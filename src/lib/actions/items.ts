"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { enqueueAndRun } from "@/lib/sync/jobs";
import {
  knowledgeItemInputSchema,
  slugify,
  type KnowledgeItemInput,
} from "@/lib/schemas";
import {
  addHubApproval,
  getApprovalState,
  mergePreservedApproval,
  userAlreadyApproved,
} from "@/lib/approaches";
import { isActiveTypeSlug } from "@/lib/knowledge-sections";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ItemStatus } from "@/lib/types";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Runs the post-mutation pipeline: reindex for RAG + Google Sheets mirror.
 * Each step is an idempotent job — failures stay queued and retryable, and
 * never roll back the database write.
 */
async function syncAfterMutation(itemId: string): Promise<void> {
  try {
    await enqueueAndRun("reindex", itemId);
  } catch (error) {
    console.error("[sync] reindex enqueue failed", error);
  }
  try {
    await enqueueAndRun("sheet_mirror", itemId);
  } catch (error) {
    console.error("[sync] sheet mirror enqueue failed", error);
  }
}

async function replaceTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  tagNames: string[]
): Promise<void> {
  await supabase.from("item_tags").delete().eq("item_id", itemId);

  for (const name of tagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const { data: tag } = await supabase
      .from("tags")
      .upsert({ name: name.trim(), slug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (tag) {
      await supabase
        .from("item_tags")
        .upsert({ item_id: itemId, tag_id: tag.id });
    }
  }
}

async function snapshotVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  createdBy: string
): Promise<void> {
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("title, summary, content, metadata, status")
    .eq("id", itemId)
    .single();
  if (!item) return;

  const { data: last } = await supabase
    .from("knowledge_versions")
    .select("version")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("knowledge_versions").insert({
    item_id: itemId,
    version: (last?.version ?? 0) + 1,
    title: item.title,
    summary: item.summary,
    content: item.content,
    metadata: item.metadata,
    status: item.status,
    created_by: createdBy,
  });
}

/** Creates or updates a knowledge item (editors and admins). */
export async function saveItem(raw: KnowledgeItemInput): Promise<ActionResult> {
  const profile = await requireProfile("editor");

  const parsed = knowledgeItemInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(" "),
    };
  }
  const input = parsed.data;
  if (!isActiveTypeSlug(input.type_slug)) {
    return { ok: false, error: `Apartado no disponible: ${input.type_slug}` };
  }

  const supabase = await createClient();

  const { data: type } = await supabase
    .from("knowledge_types")
    .select("id")
    .eq("slug", input.type_slug)
    .single();
  if (!type) {
    return { ok: false, error: `Apartado desconocido: ${input.type_slug}` };
  }

  let metadata = input.metadata as Record<string, unknown>;
  if (input.id) {
    const { data: current } = await supabase
      .from("knowledge_items")
      .select("metadata")
      .eq("id", input.id)
      .single();
    metadata = mergePreservedApproval(
      metadata,
      (current?.metadata ?? {}) as Record<string, unknown>
    );
  } else {
    metadata = mergePreservedApproval(metadata, {});
  }

  const fields = {
    type_id: type.id,
    title: input.title,
    summary: input.summary || null,
    content: input.content,
    metadata,
    status: input.status,
  };

  let itemId: string;

  if (input.id) {
    const { error } = await supabase
      .from("knowledge_items")
      .update(fields)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    itemId = input.id;
  } else {
    const { data: created, error } = await supabase
      .from("knowledge_items")
      .insert({ ...fields, owner_id: profile.id })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "No se pudo crear." };
    }
    itemId = created.id;
  }

  await replaceTags(supabase, itemId, input.tags);

  await supabase.from("sources").delete().eq("item_id", itemId);
  if (input.sources.length > 0) {
    await supabase.from("sources").insert(
      input.sources.map((s) => ({
        item_id: itemId,
        label: s.label,
        url: s.url,
      }))
    );
  }

  await snapshotVersion(supabase, itemId, profile.id);

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: input.id ? "item.update" : "item.create",
    entity: "knowledge_items",
    entityId: itemId,
    detail: { title: input.title, status: input.status },
  });

  await syncAfterMutation(itemId);

  revalidatePath("/", "layout");
  return { ok: true, id: itemId };
}

/** Marks an approach as approved in the hub. Any signed-in user can do it. */
export async function approveApproach(itemId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id, metadata")
    .eq("id", itemId)
    .single();
  if (!item) return { ok: false, error: "Elemento no encontrado." };

  const current = (item.metadata ?? {}) as Record<string, unknown>;
  if (userAlreadyApproved(current, profile.id)) {
    return { ok: true, id: itemId };
  }

  const metadata = addHubApproval(current, {
    approved_by_id: profile.id,
    approved_by_name: profile.full_name?.trim() || profile.email,
    approved_by_email: profile.email,
    approved_at: new Date().toISOString(),
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from("knowledge_items")
    .update({ metadata })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await snapshotVersion(admin, itemId, profile.id);
  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "item.approve",
    entity: "knowledge_items",
    entityId: itemId,
    detail: {
      approved_by_name: profile.full_name?.trim() || profile.email,
      approval_state: getApprovalState(metadata),
    },
  });
  await syncAfterMutation(itemId);

  revalidatePath("/", "layout");
  return { ok: true, id: itemId };
}

/** Changes an item's status (publish / archive / back to draft). */
export async function setItemStatus(
  itemId: string,
  status: ItemStatus
): Promise<ActionResult> {
  const profile = await requireProfile("editor");
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_items")
    .update({ status })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await snapshotVersion(supabase, itemId, profile.id);
  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: `item.status.${status}`,
    entity: "knowledge_items",
    entityId: itemId,
  });
  await syncAfterMutation(itemId);

  revalidatePath("/", "layout");
  return { ok: true, id: itemId };
}

/** Permanently deletes an item (admins only; RLS enforces it too). */
export async function deleteItem(itemId: string): Promise<ActionResult> {
  const profile = await requireProfile("admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_items")
    .delete()
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "item.delete",
    entity: "knowledge_items",
    entityId: itemId,
  });

  revalidatePath("/", "layout");
  return { ok: true, id: itemId };
}

/** Restores the content of a previous version as a new edit. */
export async function restoreVersion(
  itemId: string,
  versionId: string
): Promise<ActionResult> {
  const profile = await requireProfile("editor");
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("knowledge_versions")
    .select("title, summary, content, metadata")
    .eq("id", versionId)
    .eq("item_id", itemId)
    .single();
  if (!version) return { ok: false, error: "Versión no encontrada." };

  const { error } = await supabase
    .from("knowledge_items")
    .update({
      title: version.title,
      summary: version.summary,
      content: version.content,
      metadata: version.metadata,
    })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await snapshotVersion(supabase, itemId, profile.id);
  await audit({
    actorId: profile.id,
    actorEmail: profile.email,
    action: "item.restore_version",
    entity: "knowledge_items",
    entityId: itemId,
    detail: { versionId },
  });
  await syncAfterMutation(itemId);

  revalidatePath("/", "layout");
  return { ok: true, id: itemId };
}
