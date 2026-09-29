-- free-tier projects pause after 7 days of inactivity, and an anon select filtered to []
-- by RLS did not count as activity. ping() performs a real write instead.
create table public.keepalive (
  id smallint primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

-- no policies: the table is reachable only through ping()
alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;

create function public.ping()
returns timestamptz language sql security definer set search_path = public as $$
  insert into public.keepalive (id, pinged_at) values (1, now())
  on conflict (id) do update set pinged_at = excluded.pinged_at
  returning pinged_at;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
