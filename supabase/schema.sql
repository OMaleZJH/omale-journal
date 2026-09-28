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

-- 编辑内容不覆盖并发更新的统计；点赞和浏览在行锁内完成。
create or replace function public.omale_save_content(content_kind text,content_id text,content_data jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if content_kind not in ('posts','projects') then raise exception 'Invalid content kind'; end if;
  insert into omale_records(kind,id,data) values(content_kind,content_id,content_data)
  on conflict(kind,id) do update set data=excluded.data || jsonb_build_object('likes',coalesce(omale_records.data->'likes','0'::jsonb),'views',coalesce(omale_records.data->'views','0'::jsonb)) returning data into result;
  return result;
end;
$$;
create or replace function public.omale_engage(content_kind text,content_id text,actor_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; like_key text; is_liked boolean:=false; likes_count integer; views_count integer;
begin
  if content_kind not in ('posts','projects') then raise exception 'Invalid content kind'; end if;
  select data into item from omale_records where kind=content_kind and id=content_id for update;
  if item is null then raise exception 'Content not found'; end if;
  likes_count:=coalesce((item->>'likes')::integer,0);views_count:=coalesce((item->>'views')::integer,0);
  if actor_id is null then views_count:=views_count+1;
  else
    like_key:=content_kind||':'||content_id||':'||actor_id;
    is_liked:=not exists(select 1 from omale_records where kind='likes' and id=like_key);
    if is_liked then
      insert into omale_records(kind,id,data) values('likes',like_key,jsonb_build_object('id',like_key,'kind',content_kind,'targetId',content_id,'userId',actor_id,'createdAt',now()));
      likes_count:=likes_count+1;
    else
      delete from omale_records where kind='likes' and id=like_key;
      likes_count:=greatest(0,likes_count-1);
    end if;
  end if;
  update omale_records set data=item||jsonb_build_object('likes',likes_count,'views',views_count) where kind=content_kind and id=content_id;
  return jsonb_build_object('count',likes_count,'views',views_count,'liked',is_liked);
end;
$$;
revoke execute on function public.omale_save_content(text,text,jsonb),public.omale_engage(text,text,text) from public,anon,authenticated;
grant execute on function public.omale_save_content(text,text,jsonb),public.omale_engage(text,text,text) to service_role;
