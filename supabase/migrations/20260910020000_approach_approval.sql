-- Backfill approval_state from the wiki Status column on existing approaches.

update public.knowledge_items ki
set metadata = jsonb_set(
  coalesce(ki.metadata, '{}'::jsonb),
  '{approval_state}',
  to_jsonb(
    case lower(coalesce(ki.metadata->>'Status', ''))
      when 'approved' then 'approved'
      when 'discarded' then 'discarded'
      when 'rejected' then 'discarded'
      when 'obsolete' then 'discarded'
      else 'pending'
    end
  )
)
where ki.type_id in (
  select id from public.knowledge_types where slug = 'approaches'
)
and (ki.metadata->>'approval_state') is null;
