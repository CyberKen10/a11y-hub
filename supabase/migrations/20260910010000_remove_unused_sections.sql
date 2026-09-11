-- Remove sections the team no longer wants in the hub.
-- Items of those types are deleted first (no ON DELETE CASCADE on type_id).

delete from public.knowledge_items
where type_id in (
  select id
  from public.knowledge_types
  where slug in (
    'estandares',
    'patrones',
    'casos-de-estudio',
    'investigacion',
    'glosario',
    'recursos'
  )
);

delete from public.knowledge_types
where slug in (
  'estandares',
  'patrones',
  'casos-de-estudio',
  'investigacion',
  'glosario',
  'recursos'
);
