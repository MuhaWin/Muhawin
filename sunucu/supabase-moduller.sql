-- =====================================================================
-- MuhaWin · modül bazlı lisans güncellemesi (supabase-kurulum.sql'den SONRA, bir kez)
-- Supabase paneli → SQL Editor → New query → bu dosyanın tamamını yapıştırın → Run
-- Tekrar çalıştırılabilir; mevcut kayıtları silmez.
--
-- Modüller:  ekstre  = Ekstre → Luca (banka + kredi kartı)
--            fatura  = Fatura – Muavin Kontrol
--            (okc, denetim: yakında; şimdiden kod/lisans tanımlanabilir)
-- Mevcut tüm lisanslar ve 1000 lisans kodu "ekstre" modülüne aittir.
-- Eski Ekstre Luca (1.5.x) programları çalışmaya devam eder: app_status'un üst düzey alanları
-- yine Ekstre modülünün durumunu verir; yeni program "modules" alanını okur.
-- =====================================================================

alter table public.license_codes add column if not exists module text not null default 'ekstre';
alter table public.licenses      add column if not exists module text not null default 'ekstre';
create index if not exists licenses_user_module on public.licenses(user_id, module);

-- Modül başına deneme süresi. Ekstre'nin denemesi eskisi gibi profiles.trial_start/trial_days'tedir;
-- diğer modüllerin denemesi, modül ilk açıldığında (app_status p_module ile) başlar.
create table if not exists public.module_trials (
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  trial_start timestamptz not null default now(),
  trial_days int not null default 7,
  primary key (user_id, module)
);
alter table public.module_trials enable row level security;
revoke all on public.module_trials from anon, authenticated;

create table if not exists public.modules (
  id text primary key,
  name text not null,
  active boolean not null default true,
  trial_days int not null default 7,
  sort int not null default 0
);
alter table public.modules enable row level security;
revoke all on public.modules from anon, authenticated;
insert into public.modules(id, name, active, trial_days, sort) values
  ('ekstre',  'Ekstre → Luca',            true,  7, 1),
  ('fatura',  'Fatura – Muavin Kontrol',  true,  7, 2),
  ('okc',     'ÖKC Fiş Girişi',           false, 7, 3),
  ('denetim', 'Denetim ve Analiz',        false, 7, 4)
on conflict (id) do nothing;

-- ---------- bir modülün durumu ----------
create or replace function public._module_status(p_uid uuid, p_module text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; m public.modules; lic_end timestamptz; t_start timestamptz; t_days int; trial_end timestamptz;
begin
  select * into p from public.profiles where id = p_uid;
  select * into m from public.modules where id = p_module;
  if not found then return jsonb_build_object('module', p_module, 'valid', false, 'reason', 'Bilinmeyen modül.'); end if;
  select max(ends_at) into lic_end from public.licenses where user_id = p_uid and module = p_module;
  if p_module = 'ekstre' then
    t_start := p.trial_start; t_days := p.trial_days;
  else
    select trial_start, trial_days into t_start, t_days from public.module_trials where user_id = p_uid and module = p_module;
  end if;
  trial_end := case when t_start is null then null else t_start + make_interval(days => t_days) end;
  if not m.active then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', false, 'valid', false, 'type', 'soon', 'reason', 'Yakında.');
  end if;
  if p.disabled then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'type', 'disabled',
      'reason', 'Hesabınız kapatılmış. ' || coalesce(p.note, ''));
  end if;
  if lic_end is not null and lic_end > now() then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', true, 'type', 'pool',
      'license_end', lic_end, 'expires', to_char(lic_end, 'YYYY-MM-DD'), 'daysLeft', ceil(extract(epoch from (lic_end - now())) / 86400)::int);
  elsif trial_end is null and lic_end is null then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'type', 'trial', 'trialAvailable', true,
      'trial_days', m.trial_days, 'reason', 'Modülü açınca ' || m.trial_days || ' günlük deneme süresi başlar.');
  elsif trial_end > now() and lic_end is null then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', true, 'type', 'trial',
      'trial_end', trial_end, 'expires', to_char(trial_end, 'YYYY-MM-DD'), 'daysLeft', ceil(extract(epoch from (trial_end - now())) / 86400)::int);
  elsif lic_end is not null then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'expired', true, 'type', 'pool',
      'license_end', lic_end, 'reason', 'Lisans süresi ' || to_char(lic_end, 'DD.MM.YYYY') || ' tarihinde doldu. Yeni lisans kodu girin.');
  else
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'trialExpired', true, 'type', 'trial',
      'trial_end', trial_end, 'reason', t_days || ' günlük deneme süresi doldu. Devam etmek için lisans kodu girin.');
  end if;
end $$;

-- ---------- genel durum (eski alanlar = Ekstre; yeni: modules) ----------
create or replace function public._status_of(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; e jsonb; res jsonb; mods jsonb;
begin
  select * into p from public.profiles where id = p_uid;
  if not found then return jsonb_build_object('valid', false, 'reason', 'Profil bulunamadı.'); end if;
  select coalesce(jsonb_object_agg(id, public._module_status(p_uid, id)), '{}'::jsonb) into mods from public.modules;
  e := public._module_status(p_uid, 'ekstre');
  res := jsonb_build_object('email', p.email, 'reg', p.reg, 'server_time', now(),
    'trial_end', p.trial_start + make_interval(days => p.trial_days),
    'license_end', (select max(ends_at) from public.licenses where user_id = p_uid and module = 'ekstre'),
    'is_admin', exists(select 1 from public.admins where user_id = p_uid),
    'offline_days', (select (value #>> '{}')::int from public.settings where key = 'offline_days'),
    'modules', mods,
    'module_list', (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active) order by sort) from public.modules));
  return res || (e - 'module' - 'name' - 'active' - 'license_end' - 'trial_end');
end $$;

-- ---------- program açılışı / modül açılışı ----------
-- p_module verilirse ve o modülde hiç deneme/lisans yoksa deneme süresi o an başlar.
drop function if exists public.app_status(text, text, text);
create or replace function public.app_status(p_device text, p_name text default null, p_version text default null, p_module text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); maxd int; n int; em text; m public.modules;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  select lower(email) into em from auth.users where id = uid;
  insert into public.profiles(id, email) values (uid, em) on conflict (id) do nothing;
  if p_device is not null and p_device <> '' then
    if exists (select 1 from public.devices where user_id = uid and device_id = p_device) then
      update public.devices set last_seen = now(), name = coalesce(p_name, name) where user_id = uid and device_id = p_device;
    else
      select coalesce((value #>> '{}')::int, 2) into maxd from public.settings where key = 'max_devices';
      select count(*) into n from public.devices where user_id = uid;
      if n >= coalesce(maxd, 2) and not public._is_admin() then
        return public._status_of(uid) || jsonb_build_object('valid', false, 'type', 'devices', 'devicesBlocked', true,
          'reason', 'Bu hesap en fazla ' || coalesce(maxd, 2) || ' bilgisayarda kullanılabilir. Bilgisayar değiştirdiyseniz bilgi@smmmantalya.com adresine yazın.');
      end if;
      insert into public.devices(user_id, device_id, name) values (uid, p_device, p_name);
    end if;
  end if;
  if p_module is not null and p_module <> 'ekstre' then
    select * into m from public.modules where id = p_module;
    if found and m.active and not exists (select 1 from public.licenses where user_id = uid and module = p_module) then
      insert into public.module_trials(user_id, module, trial_days) values (uid, p_module, m.trial_days) on conflict do nothing;
    end if;
  end if;
  update public.profiles set last_seen = now(), app_version = coalesce(p_version, app_version) where id = uid;
  return public._status_of(uid);
end $$;

-- ---------- lisans kodu: kodun modülü uzatılır ----------
create or replace function public.activate_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); v text; h text; c public.license_codes; base timestamptz; mname text;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  v := regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
  v := translate(v, 'ILOU', '110V');
  if length(v) <> 50 then
    return jsonb_build_object('valid', false, 'reason', 'Lisans kodu 50 haneli olmalı.');
  end if;
  h := encode(extensions.digest(v, 'sha256'), 'hex');
  select * into c from public.license_codes where code_hash = h for update;
  if not found then return jsonb_build_object('valid', false, 'reason', 'Lisans kodu geçersiz.'); end if;
  select name into mname from public.modules where id = c.module;
  if c.used_by is not null and c.used_by <> uid then
    return jsonb_build_object('valid', false, 'reason', 'Bu lisans kodu başka bir hesapta kullanılmış.');
  end if;
  if c.used_by = uid then
    return public._status_of(uid) || jsonb_build_object('note', 'Bu kod hesabınızda zaten etkin (' || coalesce(mname, c.module) || ').', 'activated_module', c.module);
  end if;
  update public.license_codes set used_by = uid, used_at = now() where code_hash = h;
  select greatest(now(), coalesce(max(ends_at), now())) into base from public.licenses where user_id = uid and module = c.module;
  insert into public.licenses(user_id, source, code_hash, starts_at, ends_at, module)
    values (uid, 'kod', h, now(), base + make_interval(days => c.days), c.module);
  return public._status_of(uid) || jsonb_build_object('activated_module', c.module,
    'note', coalesce(mname, c.module) || ' modülü lisansı ' || c.days || ' gün uzatıldı.');
end $$;

-- ---------- yönetici: modül parametreli ----------
drop function if exists public.admin_set_trial(uuid, int);
create or replace function public.admin_set_trial(p_user uuid, p_days_from_now int, p_module text default 'ekstre') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
  if p_module = 'ekstre' then
    update public.profiles set trial_days = greatest(0, ceil(extract(epoch from (now() + make_interval(days => p_days_from_now) - trial_start)) / 86400)::int)
      where id = p_user;
  else
    insert into public.module_trials(user_id, module, trial_start, trial_days) values (p_user, p_module, now(), greatest(0, p_days_from_now))
      on conflict (user_id, module) do update set trial_days =
        greatest(0, ceil(extract(epoch from (now() + make_interval(days => p_days_from_now) - module_trials.trial_start)) / 86400)::int);
  end if;
  return public._status_of(p_user);
end $$;

drop function if exists public.admin_grant(uuid, int, text);
create or replace function public.admin_grant(p_user uuid, p_days int, p_note text default null, p_module text default 'ekstre') returns jsonb
language plpgsql security definer set search_path = public as $$
declare base timestamptz;
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
  select greatest(now(), coalesce(max(ends_at), now())) into base from public.licenses where user_id = p_user and module = p_module;
  insert into public.licenses(user_id, source, starts_at, ends_at, note, created_by, module)
    values (p_user, 'yonetici', now(), base + make_interval(days => p_days), p_note, auth.uid(), p_module);
  return public._status_of(p_user);
end $$;

drop function if exists public.admin_end_license(uuid);
create or replace function public.admin_end_license(p_user uuid, p_module text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
  update public.licenses set ends_at = now() where user_id = p_user and ends_at > now() and (p_module is null or module = p_module);
  return public._status_of(p_user);
end $$;

create or replace function public.admin_codes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
  return jsonb_build_object('total', (select count(*) from public.license_codes),
    'used', (select count(*) from public.license_codes where used_by is not null),
    'by_module', (select coalesce(jsonb_object_agg(module, x), '{}'::jsonb) from (
       select module, jsonb_build_object('total', count(*), 'used', count(used_by)) x from public.license_codes group by module) t));
end $$;

-- ---------- yetkiler ----------
revoke all on function public.app_status(text, text, text, text), public.activate_code(text),
  public.admin_set_trial(uuid, int, text), public.admin_grant(uuid, int, text, text), public.admin_end_license(uuid, text),
  public.admin_codes(), public._status_of(uuid), public._module_status(uuid, text) from public, anon;
grant execute on function public.app_status(text, text, text, text), public.activate_code(text),
  public.admin_set_trial(uuid, int, text), public.admin_grant(uuid, int, text, text), public.admin_end_license(uuid, text),
  public.admin_codes() to authenticated;
revoke all on function public._status_of(uuid), public._module_status(uuid, text) from authenticated;

-- PostgREST şema önbelleğini yenile (yeni fonksiyonlar hemen görünsün)
notify pgrst, 'reload schema';

-- ---------- 2.6.0 modül düzeni (tekrar çalıştırılabilir) ----------
update public.modules set name='Muhasebe İşlemleri', sort=1, active=true where id='fatura';
update public.modules set name='Banka İşlemleri', sort=2, active=true where id='ekstre';
update public.modules set name='ÖKC Fiş Girişi', sort=3 where id='okc';
update public.modules set name='Denetim ve Analiz', sort=4, active=true where id='denetim';
insert into public.modules(id, name, active, trial_days, sort) values ('fis','Fiş İşlemleri',true,7,5)
  on conflict (id) do update set name=excluded.name, active=true, sort=5;
notify pgrst, 'reload schema';

-- ---------- 2.7.0: ÖKC açık; Denetim, Fiş İşlemleri, Geçici Vergi yakında ----------
update public.modules set active=true, name='ÖKC Fiş Girişi', sort=3 where id='okc';
update public.modules set active=false, sort=4 where id='denetim';
update public.modules set active=false, sort=5 where id='fis';
insert into public.modules(id, name, active, trial_days, sort) values ('gecici','Geçici Vergi İşlemleri',false,7,6)
  on conflict (id) do update set name=excluded.name, active=false, sort=6;
notify pgrst, 'reload schema';

-- ---------- 2.7.0 (son): Fiş İşlemleri kaldırıldı; Özel İşlemler (Çek / Senet Kayıtları) açık ----------
delete from public.module_trials where module='fis';
delete from public.modules where id='fis';
insert into public.modules(id, name, active, trial_days, sort) values ('ozel','Özel İşlemler',true,7,5)
  on conflict (id) do update set name=excluded.name, active=true, sort=5;
update public.modules set active=true, name='ÖKC Fiş Girişi', sort=3 where id='okc';
update public.modules set active=false, name='Denetim ve Analiz', sort=4 where id='denetim';
insert into public.modules(id, name, active, trial_days, sort) values ('gecici','Geçici Vergi İşlemleri',false,7,6)
  on conflict (id) do update set name=excluded.name, active=false, sort=6;
notify pgrst, 'reload schema';
