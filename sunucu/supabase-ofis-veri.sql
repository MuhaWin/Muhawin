-- =====================================================================
-- MuhaWin · Ofis ortak verisi (ofis_veri): firmalar, kurallar, kararlar ofisteki tüm bilgisayarlarda ortak.
-- Tasarım: yonetim/belgeler/bulut-veri-tasarimi.md. supabase-ofis.sql'den SONRA çalıştırın; tekrar çalıştırılabilir, veri silmez.
--
-- 1. BÖLÜM: canlı sunucudaki tanımlar (23.10.2026 şema dökümünden depoya alındı; o güne dek depoda yoktu).
--    Tablo kısıtları dökümde yoktu; ofis_veri_yaz'daki "on conflict (sahip, tur, firma, anahtar)" ve sütun tiplerinden çıkarıldı.
--    Fonksiyon gövdeleri canlıdakiyle birebir aynıdır.
-- 2. BÖLÜM: güvenlik yaması (Görev 07, rapor-07). 1. bölümdeki fonksiyonların üzerine yazar:
--    · Silme (silindi=true) yalnız ofis yöneticisine; ayar: settings 'ofis_veri_silme' = 'yonetici' (varsayılan) | 'herkes'
--    · Sahip başına satır sınırı ve istek başına toplam boyut sınırı
--    · Yardımcı fonksiyonlar istemciye kapalı; RPC'ler yalnız giriş yapmış kullanıcılara
-- =====================================================================

-- ---------- 1. BÖLÜM: canlıdaki hâl ----------
create sequence if not exists public.ofis_veri_surum;
create table if not exists public.ofis_veri (
  sahip       uuid not null,                     -- ofis kimliği; ofissiz kullanıcıda kullanıcının kendi kimliği (_veri_sahibi)
  tur         text not null,
  firma       text not null default '',
  anahtar     text not null default '',
  veri        jsonb,                             -- silinmişse null
  silindi     boolean not null default false,
  surum       bigint not null default nextval('public.ofis_veri_surum'),
  guncelleyen uuid,
  guncellendi timestamptz not null default now(),
  primary key (sahip, tur, firma, anahtar)
);
create index if not exists ofis_veri_sahip_surum on public.ofis_veri (sahip, surum);
alter table public.ofis_veri enable row level security;
revoke all on public.ofis_veri from anon, authenticated;
revoke all on sequence public.ofis_veri_surum from anon, authenticated;

CREATE OR REPLACE FUNCTION public._veri_sahibi(p_uid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select office_id from public.office_members where user_id = p_uid), p_uid);
$function$;

CREATE OR REPLACE FUNCTION public._veri_yetkili(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_uid is not null and not coalesce((select disabled from public.profiles where id = p_uid), false);
$function$;

CREATE OR REPLACE FUNCTION public.ofis_veri_yaz(p_satirlar jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); s uuid; x jsonb; n int := 0; son bigint := 0; v bigint;
begin
  if not public._veri_yetkili(uid) then raise exception 'Yetkisiz'; end if;
  if jsonb_typeof(p_satirlar) <> 'array' or jsonb_array_length(p_satirlar) > 500 then raise exception 'Geçersiz istek'; end if;
  s := public._veri_sahibi(uid);
  for x in select * from jsonb_array_elements(p_satirlar) loop
    if coalesce(x->>'tur', '') !~ '^[a-z_]{2,20}$' or length(coalesce(x->>'firma', '')) > 100 or length(coalesce(x->>'anahtar', '')) > 300 then
      raise exception 'Geçersiz satır'; end if;
    if octet_length(coalesce(x->'veri', 'null'::jsonb)::text) > 3000000 then raise exception 'Satır çok büyük'; end if;
    insert into public.ofis_veri as o (sahip, tur, firma, anahtar, veri, silindi, guncelleyen, guncellendi, surum)
    values (s, x->>'tur', coalesce(x->>'firma', ''), coalesce(x->>'anahtar', ''),
            case when coalesce((x->>'silindi')::boolean, false) then null else x->'veri' end,
            coalesce((x->>'silindi')::boolean, false), uid, now(), nextval('public.ofis_veri_surum'))
    on conflict (sahip, tur, firma, anahtar) do update
      set veri = excluded.veri, silindi = excluded.silindi, guncelleyen = uid, guncellendi = now(), surum = nextval('public.ofis_veri_surum')
    returning o.surum into v;
    n := n + 1; son := greatest(son, v);
  end loop;
  return jsonb_build_object('sahip', s, 'yazilan', n, 'surum', son);
end $function$;

CREATE OR REPLACE FUNCTION public.ofis_veri_degisenler(p_surum bigint DEFAULT 0, p_limit integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); s uuid; lim int := least(greatest(coalesce(p_limit, 1000), 1), 2000); rows jsonb; son bigint;
begin
  if not public._veri_yetkili(uid) then raise exception 'Yetkisiz'; end if;
  s := public._veri_sahibi(uid);
  select coalesce(jsonb_agg(jsonb_build_object('tur', tur, 'firma', firma, 'anahtar', anahtar, 'veri', veri, 'silindi', silindi,
           'surum', surum, 'guncelleyen', guncelleyen, 'guncellendi', guncellendi) order by surum), '[]'::jsonb), max(surum)
    into rows, son
    from (select * from public.ofis_veri where sahip = s and surum > coalesce(p_surum, 0) order by surum limit lim) x;
  return jsonb_build_object('sahip', s, 'satirlar', rows, 'surum', coalesce(son, p_surum, 0), 'devam', jsonb_array_length(rows) = lim);
end $function$;


-- ---------- 2. BÖLÜM: güvenlik yaması (Görev 07) ----------
-- Silme yetkisi kullanıcı kararıdır (bulut-veri-tasarimi.md §7.1); karar verilene dek güvenli taraf: yalnız yönetici.
--   Herkes silebilsin:   insert into public.settings(key, value) values ('ofis_veri_silme', '"herkes"') on conflict (key) do update set value = excluded.value;
insert into public.settings(key, value) values ('ofis_veri_silme', '"yonetici"') on conflict (key) do nothing;

-- Silme yetkisi: ofissiz kullanıcı kendi verisinin sahibidir; ofiste ayar 'herkes' değilse yalnız yönetici siler
create or replace function public._veri_silebilir(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.office_members where user_id = p_uid) then true
    when coalesce((select value #>> '{}' from public.settings where key = 'ofis_veri_silme'), 'yonetici') = 'herkes' then true
    else coalesce((select role = 'yonetici' from public.office_members where user_id = p_uid), false)
  end;
$$;

create or replace function public.ofis_veri_yaz(p_satirlar jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s uuid; x jsonb; n int := 0; son bigint := 0; v bigint; sil boolean; mevcut int; yeni int;
  satir_siniri constant int := 200000;          -- sahip (ofis) başına satır
  istek_siniri constant int := 20000000;        -- istek başına toplam veri (bayt)
begin
  if not public._veri_yetkili(uid) then raise exception 'Yetkisiz'; end if;
  if jsonb_typeof(p_satirlar) <> 'array' or jsonb_array_length(p_satirlar) > 500 then raise exception 'Geçersiz istek'; end if;
  if octet_length(p_satirlar::text) > istek_siniri then raise exception 'İstek çok büyük'; end if;
  s := public._veri_sahibi(uid);
  -- aynı sahibin eşzamanlı yazmaları sırayla: satır sınırı yarışta aşılmasın
  perform pg_advisory_xact_lock(hashtextextended('ofis_veri:' || s::text, 0));
  for x in select * from jsonb_array_elements(p_satirlar) loop
    if coalesce(x->>'tur', '') !~ '^[a-z_]{2,20}$' or length(coalesce(x->>'firma', '')) > 100 or length(coalesce(x->>'anahtar', '')) > 300 then
      raise exception 'Geçersiz satır'; end if;
    if octet_length(coalesce(x->'veri', 'null'::jsonb)::text) > 3000000 then raise exception 'Satır çok büyük'; end if;
    sil := coalesce((x->>'silindi')::boolean, false);
    if sil and not public._veri_silebilir(uid) then raise exception 'Silme yetkiniz yok; ofis yöneticisi silebilir.'; end if;
    if not exists (select 1 from public.ofis_veri where sahip = s and tur = x->>'tur' and firma = coalesce(x->>'firma', '') and anahtar = coalesce(x->>'anahtar', '')) then
      if mevcut is null then select count(*) into mevcut from public.ofis_veri where sahip = s; yeni := 0; end if;
      yeni := yeni + 1;
      if mevcut + yeni > satir_siniri then raise exception 'Ofis veri sınırı doldu (% satır).', satir_siniri; end if;
    end if;
    insert into public.ofis_veri as o (sahip, tur, firma, anahtar, veri, silindi, guncelleyen, guncellendi, surum)
    values (s, x->>'tur', coalesce(x->>'firma', ''), coalesce(x->>'anahtar', ''),
            case when sil then null else x->'veri' end, sil, uid, now(), nextval('public.ofis_veri_surum'))
    on conflict (sahip, tur, firma, anahtar) do update
      set veri = excluded.veri, silindi = excluded.silindi, guncelleyen = uid, guncellendi = now(), surum = nextval('public.ofis_veri_surum')
    returning o.surum into v;
    n := n + 1; son := greatest(son, v);
  end loop;
  return jsonb_build_object('sahip', s, 'yazilan', n, 'surum', son);
end $$;

-- yetkiler: yardımcılar yalnız SECURITY DEFINER fonksiyonların içinden; RPC'ler yalnız giriş yapmış kullanıcıya
revoke all on function public._veri_sahibi(uuid), public._veri_yetkili(uuid), public._veri_silebilir(uuid) from public, anon, authenticated;
revoke all on function public.ofis_veri_yaz(jsonb), public.ofis_veri_degisenler(bigint, integer) from public, anon;
grant execute on function public.ofis_veri_yaz(jsonb), public.ofis_veri_degisenler(bigint, integer) to authenticated;

notify pgrst, 'reload schema';
