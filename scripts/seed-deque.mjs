import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  DEQUE_SOURCE_PREFIX,
  loadDequeItemsFromFolder,
} from "./parse-deque.mjs";

const TYPE_SLUG = "deque";
const INSERT_CHUNK = 40;
const JOB_CHUNK = 80;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function checksumOf(item) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: item.title,
        summary: item.summary,
        content: item.content,
        metadata: item.metadata,
        status: item.status,
        tags: item.tags,
      })
    )
    .digest("hex");
}

async function fetchAllExisting(supabase, typeId) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("id, source_sheet_tab, source_sheet_row, source_checksum")
      .eq("type_id", typeId)
      .like("source_sheet_tab", `${DEQUE_SOURCE_PREFIX}%`)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function indexExisting(rows) {
  const byTabRow = new Map();
  for (const row of rows) {
    byTabRow.set(`${row.source_sheet_tab}::${row.source_sheet_row}`, row);
  }
  return { byTabRow };
}

async function upsertTags(supabase, names) {
  const unique = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  const tagIdsBySlug = new Map();
  for (const name of unique) {
    const slug = slugify(name);
    if (!slug) continue;
    const { data, error } = await supabase
      .from("tags")
      .upsert({ name, slug }, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (error || !data) continue;
    tagIdsBySlug.set(data.slug, data.id);
  }
  return tagIdsBySlug;
}

async function replaceItemTags(supabase, itemId, tags, tagIdsBySlug) {
  await supabase.from("item_tags").delete().eq("item_id", itemId);
  for (const name of tags ?? []) {
    const slug = slugify(name);
    const tagId = tagIdsBySlug.get(slug);
    if (!tagId) continue;
    await supabase.from("item_tags").upsert({ item_id: itemId, tag_id: tagId });
  }
}

async function enqueueJobs(supabase, itemIds) {
  if (itemIds.length === 0) return;
  const { data } = await supabase
    .from("sync_jobs")
    .select("item_id")
    .eq("kind", "reindex")
    .in("status", ["pending", "running"])
    .in("item_id", itemIds);
  const pending = new Set((data ?? []).map((row) => row.item_id));
  const rows = itemIds
    .filter((id) => !pending.has(id))
    .map((item_id) => ({ kind: "reindex", item_id }));
  for (let i = 0; i < rows.length; i += JOB_CHUNK) {
    const chunk = rows.slice(i, i + JOB_CHUNK);
    const { error } = await supabase.from("sync_jobs").insert(chunk);
    if (error) throw new Error(`sync_jobs: ${error.message}`);
  }
}

export async function dedupePendingReindex(supabase) {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, item_id, created_at")
    .eq("kind", "reindex")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const keep = new Set();
  const drop = [];
  const sorted = [...(data ?? [])].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  for (const row of sorted) {
    if (keep.has(row.item_id)) drop.push(row.id);
    else keep.add(row.item_id);
  }
  if (drop.length === 0) return 0;
  await supabase.from("sync_jobs").delete().in("id", drop);
  return drop.length;
}

async function loadItems(providedItems) {
  if (providedItems) return { file: "upload", items: providedItems };
  return loadDequeItemsFromFolder(process.cwd());
}

export async function seedDeque(supabase, options = {}) {
  const { ownerId = null, enqueueReindex = true, items: providedItems } = options;
  const loaded = await loadItems(providedItems);
  const items = loaded.items;
  if (items.length === 0) {
    return {
      file: loaded.file,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: ["No encontré criterios WCAG en los DOCX de deque."],
      queued: 0,
    };
  }

  const { data: type, error: typeError } = await supabase
    .from("knowledge_types")
    .select("id")
    .eq("slug", TYPE_SLUG)
    .single();
  if (typeError || !type) {
    throw new Error("No existe el apartado 'deque'. ¿Corriste la migración SQL?");
  }

  const existing = indexExisting(await fetchAllExisting(supabase, type.id));
  const tagIdsBySlug = await upsertTags(
    supabase,
    items.flatMap((item) => item.tags ?? [])
  );

  const summary = {
    file: loaded.file,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    queued: 0,
  };

  const toInsert = [];
  const toUpdate = [];

  for (const item of items) {
    const checksum = checksumOf(item);
    const hit = existing.byTabRow.get(
      `${item.source_sheet_tab}::${item.source_sheet_row}`
    );
    const fields = {
      type_id: type.id,
      title: item.title,
      summary: item.summary || null,
      content: item.content,
      metadata: item.metadata,
      status: item.status,
      source_sheet_tab: item.source_sheet_tab,
      source_sheet_row: item.source_sheet_row,
      source_checksum: checksum,
      tags: item.tags ?? [],
    };
    if (hit && hit.source_checksum === checksum) {
      summary.skipped++;
      continue;
    }
    if (hit) toUpdate.push({ id: hit.id, ...fields });
    else toInsert.push(fields);
  }

  const touchedIds = [];

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const payload = chunk.map(({ tags, ...row }) => ({
      ...row,
      owner_id: ownerId,
    }));
    const { data, error } = await supabase
      .from("knowledge_items")
      .insert(payload)
      .select("id");
    if (error || !data) {
      summary.errors.push(`insert lote ${i}: ${error?.message ?? "sin datos"}`);
      continue;
    }
    summary.created += data.length;
    for (let j = 0; j < data.length; j++) {
      const id = data[j].id;
      touchedIds.push(id);
      try {
        await replaceItemTags(supabase, id, chunk[j].tags, tagIdsBySlug);
      } catch (err) {
        summary.errors.push(
          `tags ${id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  for (const row of toUpdate) {
    const { id, tags, ...fields } = row;
    const { error } = await supabase.from("knowledge_items").update(fields).eq("id", id);
    if (error) {
      summary.errors.push(`update ${id}: ${error.message}`);
      continue;
    }
    summary.updated++;
    touchedIds.push(id);
    try {
      await replaceItemTags(supabase, id, tags, tagIdsBySlug);
    } catch (err) {
      summary.errors.push(
        `tags ${id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (touchedIds.length > 0 && enqueueReindex) {
    await enqueueJobs(supabase, touchedIds);
    summary.queued = touchedIds.length;
  }

  return summary;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  console.log("Sembrando Deque (un criterio WCAG por ficha)…");
  const summary = await seedDeque(supabase, {
    ownerId: owner?.id ?? null,
    enqueueReindex: true,
  });
  const removedDupes = await dedupePendingReindex(supabase);
  console.log(JSON.stringify({ ...summary, removedDupes }, null, 2));
  if (summary.queued > 0) {
    console.log(
      "Indexación RAG en cola. En Administración → Sincronización pulsa “Procesar pendientes”."
    );
  }
  if (summary.errors.length > 0) process.exit(1);
}
