-- Prepared only: deploy and database application require separate approval.
-- Preserve the reviewed-publication reader, replacing only publication ownership.
alter function public.ktp_cms_forecast(uuid,text,jsonb) rename to ktp_cms_forecast_legacy;
alter table public.ktp_forecast_values add column review_draft_id uuid references public.ktp_cms_drafts(id);

create or replace function public.ktp_validate_rev03_lineage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if NEW.status='published' and NEW.source_time_role='CONFIRMED_SOURCE_IS_ORIGIN' then
    if NEW.normalization_manifest is null or NEW.source_sha256 is distinct from NEW.normalization_manifest->>'source_sha256'
      or NEW.normalization_manifest->>'source_month_role' is distinct from 'forecast_origin_month' then
      raise exception 'Origin archive requires verified original-workbook lineage';
    end if;
    if exists(select 1 from public.ktp_forecast_runs where dataset_id=NEW.dataset_id and source_year_month is distinct from origin_period) then
      raise exception 'Origin must equal the source month';
    end if;
    if exists(select 1 from public.ktp_forecast_values v where v.dataset_id=NEW.dataset_id and
      case when v.review_draft_id is null then v.source_first_row is null or v.source_row_count is null
      else not exists(select 1 from public.ktp_cms_forecast_publications p join public.ktp_cms_drafts d on d.id=p.draft_id
        where d.id=v.review_draft_id and d.kind='archive' and d.payload->>'originMonth'=to_char(v.origin_period,'YYYY-MM')
          and (p.dataset_id=NEW.dataset_id or d.state='accepted')) end) then
      raise exception 'Every prediction requires original-row or reviewed-draft lineage';
    end if;
  end if;
  return NEW;
end;
$$;

create function public.ktp_cms_forecast(p_actor uuid,p_operation text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  source public.ktp_forecast_datasets;
  d public.ktp_cms_drafts;
  current_id uuid;
  new_id uuid;
  origin date;
  cells jsonb;
  result jsonb;
  archive jsonb;
  overview jsonb;
  meta jsonb;
  months jsonb;
  first_month text;
  last_month text;
  month_count integer;
  cell_count integer;
  published timestamptz;
begin
  perform public.ktp_cms_operation(p_actor,'access','{}'::jsonb);
  current_id := (public.ktp_latest_forecast_revision()->>'datasetId')::uuid;
  if p_operation = 'history' then
    select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
      select f.dataset_id as "datasetId", f.version_label as "datasetVersion", f.published_at as "publishedAt",
        p.review->>'originMonth' as "originMonth", p.review->>'reason' as reason,
        f.dataset_id=current_id as current,
        (select jsonb_agg(m->>'period' order by m->>'period' desc) from jsonb_array_elements(f.archive_manifest->'targetMonths') m) as periods
      from public.ktp_forecast_datasets f left join public.ktp_cms_forecast_publications p using(dataset_id)
      where f.status='published' and f.source_time_role='CONFIRMED_SOURCE_IS_ORIGIN'
      order by f.published_at desc,f.dataset_id desc limit 100
    ) x;
    return result;
  end if;
  select * into source from public.ktp_forecast_datasets where dataset_id=current_id;
  if p_operation = 'readiness' then
    if source.dataset_id is null then return jsonb_build_object('revision',null,'rounds','[]'::jsonb); end if;
    select jsonb_agg(x order by x."originMonth" desc) into result from (
      select to_char(r.origin_period,'YYYY-MM') as "originMonth",count(distinct r.horizon) as horizons,
        count(v.subdistrict_code) as cells, count(*) filter(where v.study_scope='IN_SCOPE') as predicted,
        count(*) filter(where v.study_scope='OUT_OF_SCOPE') as "outOfScope",
        to_char(min(r.target_period),'YYYY-MM') as "targetStart",to_char(max(r.target_period),'YYYY-MM') as "targetEnd"
      from public.ktp_forecast_runs r left join public.ktp_forecast_values v using(dataset_id,origin_period,horizon)
      where r.dataset_id=current_id group by r.origin_period
    ) x;
    return jsonb_build_object('revision',public.ktp_latest_forecast_revision(),'rounds',result,
      'checkedAt',clock_timestamp(),'currentMonth',to_char(clock_timestamp() at time zone 'Asia/Bangkok','YYYY-MM'),
      'areaCount',(select count(*) from public.ktp_subdistricts));
  end if;
  if p_operation = 'template' then
    if current_id is distinct from (p_args->>'datasetId')::uuid then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
    if coalesce(p_args->>'originMonth','') !~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'cms_invalid_month'; end if;
    origin := (p_args->>'originMonth'||'-01')::date;
    if exists(select 1 from public.ktp_forecast_runs where dataset_id=current_id and origin_period=origin) then
      raise exception 'cms_origin_exists' using errcode='23505';
    end if;
    if source.dataset_id is null then raise exception 'cms_not_found' using errcode='P0002'; end if;
    -- Unknown slots are deliberately invalid for publication, never 0 or out of scope.
    select jsonb_agg(jsonb_build_object('subdistrictCode',s.subdistrict_code,'horizonMonths',h,
      'targetMonth',to_char(origin+make_interval(months=>h),'YYYY-MM'),'status','insufficient_data','riskCode',null)
      order by s.subdistrict_code,h) into cells from public.ktp_subdistricts s cross join generate_series(1,6) h;
    return jsonb_build_object('schemaVersion',1,'baseDatasetId',current_id,'originMonth',p_args->>'originMonth',
      'scope',jsonb_build_object('subdistrictCodes',(select jsonb_agg(subdistrict_code order by subdistrict_code) from public.ktp_subdistricts)),
      'predictions',cells);
  end if;
  if p_operation <> 'publish' then return public.ktp_cms_forecast_legacy(p_actor,p_operation,p_args); end if;
  perform pg_advisory_xact_lock(27092701);
  select * into d from public.ktp_cms_drafts where id=(p_args->>'id')::uuid for update;
  if not found then raise exception 'cms_not_found' using errcode='P0002'; end if;
  if d.revision is distinct from (p_args->>'revision')::integer then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
  if d.state <> 'draft' then raise exception 'cms_immutable' using errcode='55000'; end if;
  if d.kind <> 'archive' then raise exception 'cms_invalid_archive'; end if;
  if length(btrim(coalesce(p_args->>'reason',''))) not between 1 and 1000 then raise exception 'cms_reason_required'; end if;
  if coalesce(p_args->>'contentHash','') !~ '^[a-f0-9]{64}$' then raise exception 'cms_invalid_hash'; end if;
  current_id := (public.ktp_latest_forecast_revision()->>'datasetId')::uuid;
  if current_id is distinct from (d.payload->>'baseDatasetId')::uuid then raise exception 'cms_revision_conflict' using errcode='40001'; end if;
  select * into source from public.ktp_forecast_datasets where dataset_id=current_id;
  if source.dataset_id is null then raise exception 'cms_not_found' using errcode='P0002'; end if;
  if coalesce(d.payload->>'originMonth','') !~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'cms_invalid_month'; end if;
  origin := (d.payload->>'originMonth'||'-01')::date;
  cells := d.payload->'predictions';
  if (select count(*) from public.ktp_subdistricts) <> 289 or jsonb_typeof(cells) is distinct from 'array'
    or jsonb_array_length(cells) <> 1734 then raise exception 'cms_incomplete_forecast'; end if;
  select count(distinct (r."subdistrictCode",r."horizonMonths")) into cell_count
    from jsonb_to_recordset(cells) r("subdistrictCode" text,"horizonMonths" integer,"targetMonth" text,status text,"riskCode" smallint)
    join public.ktp_subdistricts s on s.subdistrict_code=r."subdistrictCode"
    where r."horizonMonths" between 1 and 6 and r."targetMonth"=to_char(origin+make_interval(months=>r."horizonMonths"),'YYYY-MM')
      and ((r.status='predicted' and r."riskCode" in (0,1,2)) or (r.status='out_of_scope' and r."riskCode" is null));
  if cell_count <> 1734 then raise exception 'cms_invalid_forecast_cells'; end if;
  new_id := gen_random_uuid(); published := clock_timestamp();
  -- Derive the month catalogue from actual runs, including a new origin. Do not
  -- inherit stale counts, end dates or materialized risk summaries.
  with periods as (select distinct origin_period p from public.ktp_forecast_runs where dataset_id=current_id union select origin)
  select min(to_char(p,'YYYY-MM')),max(to_char(p,'YYYY-MM')),count(*),
    jsonb_agg(jsonb_build_object('period',to_char(p,'YYYY-MM'),'labelTh',
      (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from p)::integer]||' '||(extract(year from p)::integer+543),
      'horizons',(select jsonb_agg(jsonb_build_object('horizon',h,'horizonLabel',h||' เดือน','issueMonth',to_char(p,'YYYY-MM'),
        'targetMonth',to_char(p+make_interval(months=>h),'YYYY-MM')) order by h) from generate_series(1,6) h)) order by p)
    into first_month,last_month,month_count,months from periods;
  select coalesce(source.archive_manifest->'meta'->'originSources',jsonb_object_agg(m->>'period',jsonb_build_object(
    'filename',source.source_filename,'sha256',source.source_sha256,'sheet',source.archive_manifest->'meta'->>'sourceSheet','method','original')))
    into result from jsonb_array_elements(source.archive_manifest->'targetMonths') m;
  result := result || jsonb_build_object(d.payload->>'originMonth',jsonb_build_object('filename',
    case when d.payload ? 'sourceImport' then d.source_filename else 'ฉบับตรวจแก้ใน CMS' end,
    'sha256',d.payload->'sourceImport'->>'sha256','sheet',coalesce(d.payload->'sourceImport'->>'sheet','CMS'),
    'method',case when d.payload ? 'sourceImport' then 'reviewed_upload' else 'cms_review' end));
  meta := source.archive_manifest->'meta' || jsonb_build_object('datasetId',new_id,'datasetVersion','cms-'||new_id::text,'originSources',result,
    'sourceOfTruth','admin_reviewed_forecast','provenance','DERIVED','generatedAt',published,
    'reviewedFromDatasetId',current_id,'reviewedDraftId',d.id,'targetMonthCount',month_count,
    'targetMonthStart',first_month,'targetMonthEnd',last_month,'periodStart',first_month,'periodEnd',last_month,
    'issueMonthStart',first_month,'issueMonthEnd',last_month,
    'forecastTargetMonthStart',to_char((first_month||'-01')::date+interval '1 month','YYYY-MM'),
    'forecastTargetMonthEnd',to_char((last_month||'-01')::date+interval '6 months','YYYY-MM'),
    'forecastVintageCount',month_count*1734,'sourceVintageKeyCount',month_count*289);
  archive := source.archive_manifest || jsonb_build_object('meta',meta,'targetMonths',months,'horizonSummary','[]'::jsonb,'validationExamples','{}'::jsonb);
  select jsonb_agg(m||jsonb_build_object('horizons',jsonb_build_array(m->'horizons'->0)) order by m->>'period') into result from jsonb_array_elements(months) m;
  overview := source.overview_manifest || jsonb_build_object('meta',meta||jsonb_build_object('horizonCount',1,'forecastVintageCount',month_count*289),
    'targetMonths',result,'horizonSummary','[]'::jsonb,'validationExamples','{}'::jsonb);
  insert into public.ktp_forecast_datasets(dataset_id,version_label,source_filename,source_sha256,model_version,provenance,
    normalized_sha256,canonical_sha256,source_time_role,archive_manifest,overview_manifest,normalization_manifest)
    values(new_id,'cms-'||new_id::text,source.source_filename,source.source_sha256,source.model_version,'DERIVED',
      source.normalized_sha256,null,source.source_time_role,archive,overview,source.normalization_manifest);
  insert into public.ktp_cms_forecast_publications(dataset_id,draft_id,review)
    values(new_id,d.id,jsonb_build_object('baseDatasetId',current_id,'revision',d.revision,'actorId',p_actor,
      'reason',p_args->>'reason','reviewedContentHash',p_args->>'contentHash','originMonth',d.payload->>'originMonth',
      'sourceFilename',d.source_filename,'sourceSha256',d.payload->'sourceImport'->>'sha256'));
  insert into public.ktp_research_crosswalk select new_id,research_id,subdistrict_code,mapping_evidence from public.ktp_research_crosswalk where dataset_id=current_id;
  insert into public.ktp_forecast_runs(dataset_id,origin_period,horizon,source_year_month)
    select new_id,origin_period,horizon,source_year_month from public.ktp_forecast_runs where dataset_id=current_id and origin_period<>origin;
  insert into public.ktp_forecast_runs(dataset_id,origin_period,horizon,source_year_month)
    select new_id,origin,h,origin from generate_series(1,6) h;
  insert into public.ktp_forecast_values(dataset_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count,review_draft_id)
    select new_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count,review_draft_id
    from public.ktp_forecast_values where dataset_id=current_id and origin_period<>origin;
  insert into public.ktp_forecast_values(dataset_id,origin_period,horizon,subdistrict_code,research_id,study_scope,risk_level,source_first_row,source_row_count,review_draft_id)
    select new_id,origin,r."horizonMonths",r."subdistrictCode",c.research_id,
      case when r.status='predicted' then 'IN_SCOPE' else 'OUT_OF_SCOPE' end,r."riskCode",null,null,d.id
    from jsonb_to_recordset(cells) r("subdistrictCode" text,"horizonMonths" integer,status text,"riskCode" smallint)
    join public.ktp_research_crosswalk c on c.dataset_id=current_id and c.subdistrict_code=r."subdistrictCode";
  update public.ktp_forecast_datasets set status='published',published_at=published where dataset_id=new_id;
  update public.ktp_cms_drafts set state='accepted',revision=revision+1,accepted_hash=p_args->>'contentHash',accepted_at=published,
    updated_at=published,updated_by=p_actor where id=d.id returning * into d;
  insert into public.ktp_cms_audit(draft_id,actor_id,action,revision,reason,before_payload,after_payload)
    values(d.id,p_actor,'accept',d.revision,p_args->>'reason',d.payload,d.payload);
  return to_jsonb(d)-'original_payload';
end;
$$;
revoke all on function public.ktp_cms_forecast(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ktp_cms_forecast(uuid,text,jsonb) to service_role;
