-- Per-user daily AI quota so one person cannot burn the shared Gemini free tier.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  used_on date not null default (timezone('utc', now()))::date,
  kind text not null check (kind in ('chat', 'transcribe', 'speech', 'extract')),
  count int not null default 0 check (count >= 0),
  primary key (user_id, used_on, kind)
);

create index if not exists ai_usage_daily_used_on_idx
  on public.ai_usage_daily (used_on);

alter table public.ai_usage_daily enable row level security;

drop policy if exists "ai_usage_own_select" on public.ai_usage_daily;
create policy "ai_usage_own_select" on public.ai_usage_daily
  for select using (user_id = auth.uid());

-- Atomic consume: increments only while under the limit.
create or replace function public.try_consume_ai_quota(
  p_user uuid,
  p_kind text,
  p_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_day date := (timezone('utc', now()))::date;
  v_user uuid := coalesce(auth.uid(), p_user);
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'used', 0, 'limit', p_limit);
  end if;

  if p_limit < 1 then
    return jsonb_build_object('ok', false, 'used', 0, 'limit', p_limit);
  end if;

  insert into public.ai_usage_daily as u (user_id, used_on, kind, count)
  values (v_user, v_day, p_kind, 1)
  on conflict (user_id, used_on, kind)
  do update set count = u.count + 1
  where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select u.count into v_count
    from public.ai_usage_daily u
    where u.user_id = v_user and u.used_on = v_day and u.kind = p_kind;
    return jsonb_build_object('ok', false, 'used', coalesce(v_count, p_limit), 'limit', p_limit);
  end if;

  return jsonb_build_object('ok', true, 'used', v_count, 'limit', p_limit);
end;
$$;

revoke all on function public.try_consume_ai_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.try_consume_ai_quota(uuid, text, int) to service_role;
