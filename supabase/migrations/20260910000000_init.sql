-- =============================================================
-- A11y Hub — initial schema
-- Source of truth: PostgreSQL (Supabase). Google Sheets is a mirror.
-- =============================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type public.user_role as enum ('admin', 'editor', 'reader');
create type public.item_status as enum ('draft', 'published', 'archived');
create type public.sync_job_status as enum ('pending', 'running', 'done', 'failed');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'reader',
  created_at timestamptz not null default now()
);

-- First auth user becomes admin; everyone else starts as reader.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when not exists (select 1 from public.profiles) then 'admin'::public.user_role
         else 'reader'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helper used by RLS policies (security definer avoids recursion).
create or replace function public.my_role()
returns public.user_role
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Knowledge types (sections: approaches, methodologies, …) ----------
create table public.knowledge_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  fields jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Knowledge items ----------
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.knowledge_types (id),
  title text not null,
  summary text,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status public.item_status not null default 'draft',
  owner_id uuid references public.profiles (id) on delete set null,
  -- Import origin (traceability with the original spreadsheet).
  source_sheet_tab text,
  source_sheet_row int,
  source_checksum text,
  -- Mirror position (rows the app maintains in "Hub · <tipo>" tabs).
  mirror_tab text,
  mirror_row int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_items_type_idx on public.knowledge_items (type_id);
create index knowledge_items_status_idx on public.knowledge_items (status);
create index knowledge_items_updated_idx on public.knowledge_items (updated_at desc);

create trigger knowledge_items_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();

-- ---------- Versions ----------
create table public.knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items (id) on delete cascade,
  version int not null,
  title text not null,
  summary text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  status public.item_status not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

-- ---------- Tags ----------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table public.item_tags (
  item_id uuid not null references public.knowledge_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (item_id, tag_id)
);

-- ---------- Relations between items ----------
create table public.item_relations (
  id uuid primary key default gen_random_uuid(),
  from_item_id uuid not null references public.knowledge_items (id) on delete cascade,
  to_item_id uuid not null references public.knowledge_items (id) on delete cascade,
  relation text not null default 'related',
  created_at timestamptz not null default now(),
  unique (from_item_id, to_item_id, relation)
);

-- ---------- Sources cited by an item ----------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items (id) on delete cascade,
  label text not null,
  url text,
  created_at timestamptz not null default now()
);

-- ---------- Attachments (files in Supabase Storage) ----------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  extracted_text text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- RAG chunks ----------
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items (id) on delete cascade,
  chunk_index int not null,
  heading text,
  content text not null,
  token_count int not null default 0,
  embedding vector(1536),
  fts tsvector generated always as (
    to_tsvector('simple', coalesce(heading, '') || ' ' || content)
  ) stored
);

create index chunks_item_idx on public.chunks (item_id);
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding vector_cosine_ops);
create index chunks_fts_idx on public.chunks using gin (fts);

-- ---------- Conversations & messages ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  scope_type_slug text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create table public.message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

-- ---------- Sync jobs (Sheets mirror, reindex) ----------
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sheet_mirror', 'reindex')),
  item_id uuid references public.knowledge_items (id) on delete cascade,
  status public.sync_job_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sync_jobs_updated_at
  before update on public.sync_jobs
  for each row execute function public.set_updated_at();

-- ---------- Audit logs ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles enable row level security;
alter table public.knowledge_types enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_versions enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.item_relations enable row level security;
alter table public.sources enable row level security;
alter table public.attachments enable row level security;
alter table public.chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_feedback enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: everyone signed in can read; users edit their own name; admins manage roles.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- Knowledge types: readable by all; managed by admins.
create policy "types_select" on public.knowledge_types
  for select to authenticated using (true);
create policy "types_admin_write" on public.knowledge_types
  for all to authenticated using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- Knowledge items: readable by all signed-in users; editors and admins write.
create policy "items_select" on public.knowledge_items
  for select to authenticated using (true);
create policy "items_editor_insert" on public.knowledge_items
  for insert to authenticated with check (public.my_role() in ('editor', 'admin'));
create policy "items_editor_update" on public.knowledge_items
  for update to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));
create policy "items_admin_delete" on public.knowledge_items
  for delete to authenticated using (public.my_role() = 'admin');

-- Versions
create policy "versions_select" on public.knowledge_versions
  for select to authenticated using (true);
create policy "versions_editor_insert" on public.knowledge_versions
  for insert to authenticated with check (public.my_role() in ('editor', 'admin'));

-- Tags & joins
create policy "tags_select" on public.tags
  for select to authenticated using (true);
create policy "tags_editor_write" on public.tags
  for all to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));
create policy "item_tags_select" on public.item_tags
  for select to authenticated using (true);
create policy "item_tags_editor_write" on public.item_tags
  for all to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));

-- Relations
create policy "relations_select" on public.item_relations
  for select to authenticated using (true);
create policy "relations_editor_write" on public.item_relations
  for all to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));

-- Sources
create policy "sources_select" on public.sources
  for select to authenticated using (true);
create policy "sources_editor_write" on public.sources
  for all to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));

-- Attachments
create policy "attachments_select" on public.attachments
  for select to authenticated using (true);
create policy "attachments_editor_write" on public.attachments
  for all to authenticated using (public.my_role() in ('editor', 'admin'))
  with check (public.my_role() in ('editor', 'admin'));

-- Chunks: read for retrieval; writes only through the service role (indexer).
create policy "chunks_select" on public.chunks
  for select to authenticated using (true);

-- Conversations & messages: private to their owner.
create policy "conversations_own" on public.conversations
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "messages_own" on public.messages
  for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  ));

-- Feedback: users manage their own; admins can read all.
create policy "feedback_own" on public.message_feedback
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "feedback_admin_select" on public.message_feedback
  for select to authenticated using (public.my_role() = 'admin');

-- Sync jobs & audit logs: visible to admins; written by the service role.
create policy "sync_jobs_admin_select" on public.sync_jobs
  for select to authenticated using (public.my_role() = 'admin');
create policy "audit_admin_select" on public.audit_logs
  for select to authenticated using (public.my_role() = 'admin');

-- =============================================================
-- Hybrid search: vector similarity + full-text, fused with RRF.
-- =============================================================
create or replace function public.hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int default 8,
  filter_type_slugs text[] default null
)
returns table (
  chunk_id uuid,
  item_id uuid,
  item_title text,
  type_slug text,
  heading text,
  content text,
  item_updated_at timestamptz,
  score double precision
)
language sql stable
as $$
  with candidates as (
    select c.id
    from public.chunks c
    join public.knowledge_items i on i.id = c.item_id
    join public.knowledge_types t on t.id = i.type_id
    where i.status = 'published'
      and (filter_type_slugs is null or t.slug = any (filter_type_slugs))
  ),
  vec as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rnk
    from public.chunks c
    where c.id in (select id from candidates) and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit 30
  ),
  kw as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.fts, websearch_to_tsquery('simple', query_text)) desc
           ) as rnk
    from public.chunks c
    where c.id in (select id from candidates)
      and c.fts @@ websearch_to_tsquery('simple', query_text)
    limit 30
  ),
  fused as (
    select coalesce(v.id, k.id) as id,
           coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) as score
    from vec v
    full outer join kw k on k.id = v.id
  )
  select
    c.id as chunk_id,
    i.id as item_id,
    i.title as item_title,
    t.slug as type_slug,
    c.heading,
    c.content,
    i.updated_at as item_updated_at,
    f.score
  from fused f
  join public.chunks c on c.id = f.id
  join public.knowledge_items i on i.id = c.item_id
  join public.knowledge_types t on t.id = i.type_id
  order by f.score desc
  limit match_count;
$$;

-- =============================================================
-- Storage bucket for attachments
-- =============================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_bucket_read" on storage.objects
  for select to authenticated using (bucket_id = 'attachments');
create policy "attachments_bucket_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and public.my_role() in ('editor', 'admin'));
create policy "attachments_bucket_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and public.my_role() in ('editor', 'admin'));

-- =============================================================
-- Seed: knowledge sections
-- =============================================================
insert into public.knowledge_types (slug, name, description, icon, sort_order, fields) values
  ('approaches', 'Approaches', 'Enfoques de accesibilidad: cuándo usarlos, ventajas y límites.', 'compass', 1,
   '[{"key":"when_to_use","label":"Cuándo usarlo","kind":"textarea"},{"key":"pros","label":"Ventajas","kind":"list"},{"key":"cons","label":"Limitaciones","kind":"list"},{"key":"wcag_refs","label":"Criterios WCAG relacionados","kind":"list"}]'::jsonb),
  ('metodologias', 'Metodologías', 'Metodologías de trabajo y evaluación de accesibilidad.', 'workflow', 2,
   '[{"key":"steps","label":"Pasos","kind":"list"},{"key":"deliverables","label":"Entregables","kind":"list"},{"key":"tools","label":"Herramientas usadas","kind":"list"}]'::jsonb),
  ('herramientas', 'Herramientas', 'Herramientas de testing, auditoría y desarrollo.', 'wrench', 3,
   '[{"key":"vendor","label":"Proveedor","kind":"text"},{"key":"pricing","label":"Licencia / precio","kind":"text"},{"key":"url","label":"Sitio web","kind":"url"}]'::jsonb),
  ('plantillas', 'Plantillas', 'Plantillas de informes, checklists y documentos.', 'file-text', 4,
   '[{"key":"format","label":"Formato","kind":"text"}]'::jsonb);
