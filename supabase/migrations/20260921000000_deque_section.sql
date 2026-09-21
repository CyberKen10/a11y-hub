-- Apartado Deque: metodología de testeo por criterio WCAG (manuales .docx).

insert into public.knowledge_types (slug, name, description, icon, sort_order, fields)
values (
  'deque',
  'Deque',
  'Cómo testear cada criterio WCAG según los manuales de Deque. Las variantes (a, b, c) de un mismo issue van juntas.',
  'book-open',
  5,
  '[{"key":"CP","label":"SC WCAG","kind":"text"},{"key":"variants","label":"Variantes","kind":"text"},{"key":"Origen","label":"Documento","kind":"text"}]'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  fields = excluded.fields;
