import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createClient } from "@supabase/supabase-js";
import { loadApproachWikiItems, WIKI_SOURCE_PREFIX } from "./parse-approaches.mjs";

const TYPE_SLUG = "approaches";
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
      .select("id, source_sheet_tab, source_sheet_row, source_checksum, metadata")
      .eq("type_id", typeId)
      .like("source_sheet_tab", `${WIKI_SOURCE_PREFIX}%`)
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
  const bySlug = new Map();
  for (const name of names) {
    const trimmed = String(name ?? "").trim();
    const slug = slugify(trimmed);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, trimmed);
  }
  const unique = [...bySlug.entries()].map(([slug, name]) => ({ name, slug }));
  const idBySlug = new Map();
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("tags")
      .upsert(chunk, { onConflict: "slug" })
      .select("id, slug");
    if (error) throw new Error(`tags: ${error.message}`);
    for (const tag of data ?? []) idBySlug.set(tag.slug, tag.id);
  }
  return idBySlug;
}

async function replaceItemTags(supabase, itemId, tagNames, tagIdsBySlug) {
  await supabase.from("item_tags").delete().eq("item_id", itemId);
  const rows = [];
  const seen = new Set();
  for (const name of tagNames) {
    const slug = slugify(name);
    const tagId = tagIdsBySlug.get(slug);
    if (!slug || !tagId || seen.has(tagId)) continue;
    seen.add(tagId);
    rows.push({ item_id: itemId, tag_id: tagId });
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("item_tags").upsert(rows);
    if (error) throw new Error(`item_tags: ${error.message}`);
  }
}

async function insertSources(supabase, itemId, sources) {
  if (!sources?.length) return;
  await supabase.from("sources").delete().eq("item_id", itemId);
  const { error } = await supabase.from("sources").insert(
    sources.map((s) => ({ item_id: itemId, label: s.label, url: s.url }))
  );
  if (error) throw new Error(`sources: ${error.message}`);
}

async function enqueueJobs(supabase, itemIds, { reindex, mirror }) {
  let pending = new Set();
  if (reindex && itemIds.length > 0) {
    const { data } = await supabase
      .from("sync_jobs")
      .select("item_id")
      .eq("kind", "reindex")
      .in("status", ["pending", "running"])
      .in("item_id", itemIds);
    pending = new Set((data ?? []).map((row) => row.item_id));
  }
  const rows = [];
  for (const itemId of itemIds) {
    if (reindex && !pending.has(itemId)) rows.push({ kind: "reindex", item_id: itemId });
    if (mirror) rows.push({ kind: "sheet_mirror", item_id: itemId });
  }
  for (let i = 0; i < rows.length; i += JOB_CHUNK) {
    const chunk = rows.slice(i, i + JOB_CHUNK);
    const { error } = await supabase.from("sync_jobs").insert(chunk);
    if (error) throw new Error(`sync_jobs: ${error.message}`);
  }
}

/** Keeps one pending reindex job per item so Gemini quota is not wasted. */
export async function dedupePendingReindex(supabase) {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, item_id, created_at")
    .eq("kind", "reindex")
    .in("status", ["pending", "failed"])
    .order("created_at");
  if (error) throw new Error(error.message);
  const seen = new Set();
  const extras = [];
  for (const job of data ?? []) {
    if (!job.item_id) continue;
    if (seen.has(job.item_id)) extras.push(job.id);
    else seen.add(job.item_id);
  }
  for (let i = 0; i < extras.length; i += 100) {
    const { error: delError } = await supabase
      .from("sync_jobs")
      .delete()
      .in("id", extras.slice(i, i + 100));
    if (delError) throw new Error(delError.message);
  }
  return extras.length;
}

/**
 * Idempotent upsert of Wiki Approaches rows into knowledge_items.
 * Does not run embeddings (queues reindex jobs instead).
 */
export async function seedApproachWiki(supabase, options = {}) {
  const {
    ownerId = null,
    enqueueReindex = true,
    enqueueMirror = false,
    items: providedItems,
  } = options;

  const loaded = providedItems
    ? { file: "inline", items: providedItems }
    : loadApproachWikiItems();
  const items = loaded.items;
  if (items.length === 0) {
    return { file: loaded.file, created: 0, updated: 0, skipped: 0, errors: ["El Excel no produjo filas."] };
  }

  const { data: type, error: typeError } = await supabase
    .from("knowledge_types")
    .select("id")
    .eq("slug", TYPE_SLUG)
    .single();
  if (typeError || !type) {
    throw new Error("No existe el apartado 'approaches'. ¿Corriste la migración SQL?");
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
    const existingMeta = hit?.metadata ?? {};
    const metadata = { ...item.metadata, wiki_id: item.wiki_id };
    const hubApprovals = [];
    if (Array.isArray(existingMeta.hub_approvals)) {
      hubApprovals.push(...existingMeta.hub_approvals);
    } else if (existingMeta.hub_approval?.approved_by_id) {
      hubApprovals.push(existingMeta.hub_approval);
    }
    if (hubApprovals.length > 0) metadata.hub_approvals = hubApprovals;
    const reviewerCount = Array.isArray(metadata.wiki_reviewers)
      ? new Set(
          [...metadata.wiki_reviewers, ...hubApprovals.map((h) => h.approved_by_name)]
            .map((n) => String(n ?? "").trim().toLowerCase())
            .filter(Boolean)
        ).size
      : new Set(
          hubApprovals
            .map((h) => String(h.approved_by_name ?? "").trim().toLowerCase())
            .filter(Boolean)
        ).size;
    const discarded = ["discarded", "rejected", "obsolete"].includes(
      String(metadata.Status ?? "").toLowerCase()
    );
    metadata.approval_state = discarded
      ? "discarded"
      : reviewerCount >= 5
        ? "approved"
        : "pending";

    const fields = {
      type_id: type.id,
      title: item.title,
      summary: item.summary || null,
      content: item.content,
      metadata,
      status: item.status,
      source_sheet_tab: item.source_sheet_tab,
      source_sheet_row: item.source_sheet_row,
      source_checksum: checksum,
      tags: item.tags ?? [],
      sources: item.sources ?? [],
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
    const payload = chunk.map(({ tags, sources, ...row }) => ({
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
        await insertSources(supabase, id, chunk[j].sources);
      } catch (err) {
        summary.errors.push(`tags ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (const row of toUpdate) {
    const { id, tags, sources, ...fields } = row;
    const { error } = await supabase.from("knowledge_items").update(fields).eq("id", id);
    if (error) {
      summary.errors.push(`update ${id}: ${error.message}`);
      continue;
    }
    summary.updated++;
    touchedIds.push(id);
    try {
      await replaceItemTags(supabase, id, tags, tagIdsBySlug);
      await insertSources(supabase, id, sources);
    } catch (err) {
      summary.errors.push(`tags ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (touchedIds.length > 0 && (enqueueReindex || enqueueMirror)) {
    await enqueueJobs(supabase, touchedIds, {
      reindex: enqueueReindex,
      mirror: enqueueMirror,
    });
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
  const mirror = process.argv.includes("--mirror");
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  console.log("Sembrando Wiki Approaches en el apartado approaches…");
  const summary = await seedApproachWiki(supabase, {
    ownerId: owner?.id ?? null,
    enqueueReindex: true,
    enqueueMirror: mirror,
  });
  const removedDupes = await dedupePendingReindex(supabase);
  console.log(JSON.stringify({ ...summary, removedDupes }, null, 2));
  if (summary.queued > 0) {
    console.log(
      "Indexación RAG en cola. En Administración → Sincronización pulsa “Procesar pendientes” (cupo de Gemini)."
    );
  }
  if (summary.errors.length > 0) process.exit(1);
}
