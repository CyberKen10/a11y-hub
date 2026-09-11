-- Recompute approval_state: approved only with 5+ distinct wiki votes
-- (más de 4 personas). Hub votes are merged by the app; this covers the wiki list.

update public.knowledge_items ki
set metadata = jsonb_set(
  coalesce(ki.metadata, '{}'::jsonb),
  '{approval_state}',
  to_jsonb(
    case
      when lower(coalesce(ki.metadata->>'Status', '')) in ('discarded', 'rejected', 'obsolete')
        then 'discarded'
      when coalesce(jsonb_array_length(ki.metadata->'wiki_reviewers'), 0) >= 5
        then 'approved'
      else 'pending'
    end
  )
)
where ki.type_id in (
  select id from public.knowledge_types where slug = 'approaches'
);
