-- =====================================================================
-- MuhaWin · Yama 51: ofis ortak verisi (Görev 51, bulut-veri-tasarimi.md "Güncelleme – Görev 51")
-- Supabase → SQL Editor'de bir kez çalıştırın. Tekrar çalıştırılabilir; veri silmez.
-- Önce: supabase-ofis.sql ve supabase-ofis-veri.sql (canlıda kurulu).
--  1. Kural / firma silme ve değiştirme tüm çalışanlara açık (kullanıcı kararı 24.10.2026): ofis_veri_silme = 'herkes'.
--  2. İşlem günlüğü (ofis_gunluk): ofis bazında, yalnız ekleme; güncelleme ve silme yok. Ofisteki herkes görür
--     (ayar ofis_gunluk_gorunum = 'herkes' varsayılan | 'yonetici': yalnız ofis yöneticisi tümünü, çalışan kendi kayıtlarını görür).
-- =====================================================================

-- ---------- 1. silme yetkisi: herkes ----------
insert into public.settings(key, value) values ('ofis_veri_silme', '"herkes"')
  on conflict (key) do update set value = excluded.value;

-- ---------- 2. işlem günlüğü ----------
insert into public.settings(key, value) values ('ofis_gunluk_gorunum', '"herkes"') on conflict (key) do nothing;

create table if not exists public.ofis_gunluk (
  id        bigserial primary key,
  sahip     uuid not null,                      -- ofis kimliği; ofissiz kullanıcıda kendi kimliği (_veri_sahibi)
  kullanici uuid not null,
  eposta    text not null default '',
  zaman     timestamptz not null default now(),  -- sunucu zamanı
  yerel_zaman timestamptz,                       -- işlemin bilgisayardaki zamanı (internetsizken kuyruğa girdiyse farklıdır)
  tur       text not null,                       -- 'fis_sil','luca_kayit','aktarim','sorgu','rapor','banka','kural_ekle','kural_sil',…
  firma     text not null default '',
  ozet      text not null default '',
  ayrinti   jsonb,
  cihaz     text not null default '',
  istemci_id text not null default ''            -- kuyruktan iki kez gönderilirse tek kayıt (sahip + istemci_id tekil)
);
create index if not exists ofis_gunluk_sahip_zaman on public.ofis_gunluk (sahip, zaman desc);
create unique index if not exists ofis_gunluk_istemci on public.ofis_gunluk (sahip, istemci_id) where istemci_id <> '';
alter table public.ofis_gunluk enable row level security;
revoke all on public.ofis_gunluk from anon, authenticated;
revoke all on sequence public.ofis_gunluk_id_seq from anon, authenticated;

-- silinemez / değiştirilemez: tabloya doğrudan erişim kapalı; ayrıca tetikleyici (yönetici paneli de silemez)
create or replace function public._ofis_gunluk_degismez() returns trigger
language plpgsql as $$ begin raise exception 'İşlem günlüğü değiştirilemez ve silinemez.'; end $$;
drop trigger if exists ofis_gunluk_degismez on public.ofis_gunluk;
create trigger ofis_gunluk_degismez before update or delete on public.ofis_gunluk
  for each row execute function public._ofis_gunluk_degismez();

-- yazma: istemciden gelen kayıtlar (en çok 200 / istek); kullanıcı ve ofis sunucuda belirlenir
create or replace function public.ofis_gunluk_yaz(p_kayitlar jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s uuid; x jsonb; n int := 0; ep text;
begin
  if not public._veri_yetkili(uid) then raise exception 'Yetkisiz'; end if;
  if jsonb_typeof(p_kayitlar) <> 'array' or jsonb_array_length(p_kayitlar) > 200 then raise exception 'Geçersiz istek'; end if;
  if octet_length(p_kayitlar::text) > 2000000 then raise exception 'İstek çok büyük'; end if;
  s := public._veri_sahibi(uid);
  select email into ep from auth.users where id = uid;
  for x in select * from jsonb_array_elements(p_kayitlar) loop
    if coalesce(x->>'tur', '') !~ '^[a-z_]{2,30}$' then raise exception 'Geçersiz kayıt'; end if;
    insert into public.ofis_gunluk (sahip, kullanici, eposta, yerel_zaman, tur, firma, ozet, ayrinti, cihaz, istemci_id)
    values (s, uid, coalesce(ep, ''),
            case when coalesce(x->>'zaman', '') ~ '^\d{4}-\d\d-\d\dT' then (x->>'zaman')::timestamptz else null end,
            x->>'tur', left(coalesce(x->>'firma', ''), 200), left(coalesce(x->>'ozet', ''), 500),
            case when octet_length(coalesce(x->'ayrinti', 'null'::jsonb)::text) > 20000 then null else x->'ayrinti' end,
            left(coalesce(x->>'cihaz', ''), 100), left(coalesce(x->>'id', ''), 64))
    on conflict do nothing;
    n := n + 1;
  end loop;
  return jsonb_build_object('yazilan', n);
end $$;

-- okuma: süzgeçli, en yeniden eskiye; p_once (id) ile sayfalama
create or replace function public.ofis_gunluk_liste(p_suzgec jsonb default '{}'::jsonb, p_limit int default 200, p_once bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); s uuid; lim int := least(greatest(coalesce(p_limit, 200), 1), 1000); yalniz_kendi boolean; rows jsonb;
  f jsonb := coalesce(p_suzgec, '{}'::jsonb);
begin
  if not public._veri_yetkili(uid) then raise exception 'Yetkisiz'; end if;
  s := public._veri_sahibi(uid);
  yalniz_kendi := coalesce((select value #>> '{}' from public.settings where key = 'ofis_gunluk_gorunum'), 'herkes') = 'yonetici'
    and exists (select 1 from public.office_members where user_id = uid and role <> 'yonetici');
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'zaman', zaman, 'yerel_zaman', yerel_zaman, 'eposta', eposta, 'tur', tur,
           'firma', firma, 'ozet', ozet, 'ayrinti', ayrinti, 'cihaz', cihaz) order by id desc), '[]'::jsonb)
    into rows
    from (select * from public.ofis_gunluk g
           where g.sahip = s
             and (not yalniz_kendi or g.kullanici = uid)
             and (p_once is null or g.id < p_once)
             and (coalesce(f->>'tur', '') = '' or g.tur = f->>'tur')
             and (coalesce(f->>'eposta', '') = '' or g.eposta = lower(f->>'eposta'))
             and (coalesce(f->>'firma', '') = '' or g.firma ilike '%' || (f->>'firma') || '%')
             and (coalesce(f->>'ara', '') = '' or g.ozet ilike '%' || (f->>'ara') || '%' or g.firma ilike '%' || (f->>'ara') || '%')
             and (coalesce(f->>'bas', '') = '' or g.zaman >= (f->>'bas')::date)
             and (coalesce(f->>'bit', '') = '' or g.zaman < (f->>'bit')::date + 1)
           order by g.id desc limit lim) x;
  return jsonb_build_object('kayitlar', rows, 'devam', jsonb_array_length(rows) = lim);
end $$;

revoke all on function public._ofis_gunluk_degismez() from public, anon, authenticated;
revoke all on function public.ofis_gunluk_yaz(jsonb), public.ofis_gunluk_liste(jsonb, int, bigint) from public, anon;
grant execute on function public.ofis_gunluk_yaz(jsonb), public.ofis_gunluk_liste(jsonb, int, bigint) to authenticated;

notify pgrst, 'reload schema';
