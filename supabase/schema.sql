-- 在 Supabase SQL Editor 执行一次。所有数据仅能经服务端访问，浏览器没有数据库密钥。
create table if not exists public.omale_records (
  kind text not null,
  id text not null,
  data jsonb not null,
  primary key(kind,id)
);
create unique index if not exists omale_unique_email on public.omale_records ((data->>'email')) where kind='users';
create index if not exists omale_author on public.omale_records(kind,(data->>'authorId'));
create index if not exists omale_sender on public.omale_records(kind,(data->>'senderId'));
create index if not exists omale_recipient on public.omale_records(kind,(data->>'recipientId'));
alter table public.omale_records enable row level security;
revoke all on public.omale_records from anon,authenticated;
grant all on public.omale_records to service_role;

create table if not exists public.omale_rate_limits(id text primary key,count integer not null,expires timestamptz not null);
alter table public.omale_rate_limits enable row level security;
revoke all on public.omale_rate_limits from anon,authenticated;
grant all on public.omale_rate_limits to service_role;
create or replace function public.omale_rate_limit(rate_key text,max_count integer,window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  delete from public.omale_rate_limits where expires<now();
  insert into public.omale_rate_limits(id,count,expires) values(rate_key,1,now()+make_interval(secs=>window_seconds))
  on conflict(id) do update set count=omale_rate_limits.count+1 returning count into n;
  return n<=max_count;
end;
$$;
revoke execute on function public.omale_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.omale_rate_limit(text,integer,integer) to service_role;
