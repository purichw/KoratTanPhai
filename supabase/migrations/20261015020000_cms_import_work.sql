-- Account-owned import work. Private chunked objects keep uploads below the API
-- request ceiling; only a verified complete snapshot can become the saved head.
create table public.ktp_cms_import_work (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  title text not null check(length(title) between 1 and 160),
  filename text not null check(length(filename) between 1 and 240),
  revision integer not null default 0,
  source_id uuid,
  snapshot_id uuid,
  draft_id uuid references public.ktp_cms_drafts(id),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.ktp_cms_import_objects (
  id uuid primary key,
  work_id uuid not null references public.ktp_cms_import_work(id),
  purpose text not null check(purpose in ('source','snapshot')),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  bytes integer not null check(bytes between 1 and 41943040),
  parts integer not null check(parts between 1 and 160),
  complete boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  check(purpose<>'source' or bytes<=20971520),
  check(parts=ceil(bytes/262144.0))
);
create table public.ktp_cms_import_parts (
  object_id uuid not null references public.ktp_cms_import_objects(id) on delete cascade,
  part integer not null check(part between 0 and 159),
  data bytea not null check(octet_length(data) between 1 and 262144),
  primary key(object_id,part)
);
alter table public.ktp_cms_import_work enable row level security;
alter table public.ktp_cms_import_objects enable row level security;
alter table public.ktp_cms_import_parts enable row level security;
revoke all on public.ktp_cms_import_work,public.ktp_cms_import_objects,public.ktp_cms_import_parts from public,anon,authenticated,service_role;

create function public.ktp_cms_import_work_operation(p_actor uuid,p_operation text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w public.ktp_cms_import_work;
  o public.ktp_cms_import_objects;
  b bytea;
  result jsonb;
  object_key uuid;
begin
  perform public.ktp_cms_operation(p_actor,'access','{}'::jsonb);
  if p_operation='list' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select id,title,filename,revision,updated_at,source_id,snapshot_id,draft_id from public.ktp_cms_import_work
      where owner_id=p_actor order by (draft_id is null) desc,updated_at desc,id limit 100
    ) x;
    return result;
  end if;
  if p_operation='create' then
    perform pg_advisory_xact_lock(hashtextextended(p_actor::text,27092703));
    if not exists(select 1 from public.ktp_cms_import_work where id=(p_args->>'workId')::uuid)
      and (select count(*) from public.ktp_cms_import_work where owner_id=p_actor and draft_id is null)>=100 then
      raise exception 'cms_work_limit' using errcode='54000';
    end if;
    insert into public.ktp_cms_import_work(id,owner_id,title,filename)
      values((p_args->>'workId')::uuid,p_actor,p_args->>'title',p_args->>'filename') on conflict(id) do nothing;
  end if;
  select * into w from public.ktp_cms_import_work where id=(p_args->>'workId')::uuid and owner_id=p_actor for update;
  if not found then raise exception 'cms_not_found' using errcode='P0002'; end if;
  if p_operation in ('get','create') then return to_jsonb(w); end if;
  if p_operation in ('upload','read-part') then
    object_key := (p_args->>'objectId')::uuid;
    if p_operation='upload' then
      if w.draft_id is not null then raise exception 'cms_immutable' using errcode='55000'; end if;
      if not exists(select 1 from public.ktp_cms_import_objects where id=object_key)
        and (select coalesce(sum(bytes),0) from public.ktp_cms_import_objects where work_id=w.id)+(p_args->>'bytes')::integer>104857600 then
        raise exception 'cms_work_limit' using errcode='54000';
      end if;
      insert into public.ktp_cms_import_objects(id,work_id,purpose,sha256,bytes,parts)
        values(object_key,w.id,p_args->>'purpose',p_args->>'sha256',(p_args->>'bytes')::integer,(p_args->>'parts')::integer)
        on conflict(id) do nothing;
    end if;
    select * into o from public.ktp_cms_import_objects where id=object_key and work_id=w.id for update;
    if not found then raise exception 'cms_not_found' using errcode='P0002'; end if;
    if p_operation='read-part' then
      if not o.complete or o.id not in (w.source_id,w.snapshot_id) then raise exception 'cms_not_found' using errcode='P0002'; end if;
      select jsonb_build_object('data',encode(data,'base64'),'parts',o.parts,'sha256',o.sha256) into result
        from public.ktp_cms_import_parts where object_id=o.id and part=(p_args->>'part')::integer;
      if result is null then raise exception 'cms_not_found' using errcode='P0002'; end if;
      return result;
    end if;
    if o.purpose is distinct from p_args->>'purpose' or o.sha256 is distinct from p_args->>'sha256'
      or o.bytes<>(p_args->>'bytes')::integer or o.parts<>(p_args->>'parts')::integer then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
    b := decode(p_args->>'data','base64');
    if (p_args->>'part')::integer>=o.parts or octet_length(b)<>least(262144,o.bytes-(p_args->>'part')::integer*262144) then
      raise exception 'cms_invalid_part';
    end if;
    if exists(select 1 from public.ktp_cms_import_parts where object_id=o.id and part=(p_args->>'part')::integer and data<>b) then
      raise exception 'cms_revision_conflict' using errcode='40001';
    end if;
    insert into public.ktp_cms_import_parts values(o.id,(p_args->>'part')::integer,b) on conflict do nothing;
    return jsonb_build_object('uploaded',true);
  end if;
  if p_operation='save' then
    -- An uncertain-response retry with the same snapshot is idempotent.
    if w.snapshot_id=(p_args->>'snapshotId')::uuid then return to_jsonb(w); end if;
    if w.draft_id is not null then raise exception 'cms_immutable' using errcode='55000'; end if;
    if w.revision<>(p_args->>'revision')::integer then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
    if w.source_id is not null and w.source_id is distinct from (p_args->>'sourceId')::uuid then raise exception 'cms_immutable' using errcode='55000'; end if;
    foreach object_key in array array[(p_args->>'sourceId')::uuid,(p_args->>'snapshotId')::uuid] loop
      select * into o from public.ktp_cms_import_objects where id=object_key and work_id=w.id for update;
      if not found or o.purpose<>(case when object_key=(p_args->>'sourceId')::uuid then 'source' else 'snapshot' end) then
        raise exception 'cms_invalid_object';
      end if;
      if not o.complete then
        select string_agg(data,''::bytea order by part) into b from public.ktp_cms_import_parts where object_id=o.id;
        if octet_length(b) is distinct from o.bytes or encode(sha256(b),'hex') is distinct from o.sha256 then raise exception 'cms_incomplete_object'; end if;
        update public.ktp_cms_import_objects set complete=true where id=o.id;
      end if;
    end loop;
    update public.ktp_cms_import_work set revision=revision+1,title=p_args->>'title',source_id=(p_args->>'sourceId')::uuid,
      snapshot_id=(p_args->>'snapshotId')::uuid,updated_at=clock_timestamp() where id=w.id returning * into w;
    -- Only replace disposable checkpoints after the new head is durably verified.
    delete from public.ktp_cms_import_objects where work_id=w.id and purpose='snapshot' and id<>w.snapshot_id and complete;
    return to_jsonb(w);
  end if;
  if p_operation='convert' then
    if w.draft_id is not null then
      result := public.ktp_cms_operation(p_actor,'get',jsonb_build_object('id',w.draft_id));
      if result->>'original_hash' is distinct from p_args->'draft'->>'originalHash' then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
      return result;
    end if;
    if w.revision<>(p_args->>'revision')::integer then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
    if w.snapshot_id is null then raise exception 'cms_incomplete_object'; end if;
    result := public.ktp_cms_operation(p_actor,'create',p_args->'draft');
    update public.ktp_cms_import_work set draft_id=(result->>'id')::uuid,revision=revision+1,updated_at=clock_timestamp() where id=w.id;
    return result;
  end if;
  raise exception 'cms_unknown_operation';
end;
$$;
revoke all on function public.ktp_cms_import_work_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ktp_cms_import_work_operation(uuid,text,jsonb) to service_role;
