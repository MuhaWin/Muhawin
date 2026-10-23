-- =====================================================================
-- MuhaWin · ofis hesapları ve çalışan davetleri
-- supabase-kurulum.sql ve supabase-moduller.sql'den SONRA, bir kez çalıştırın (tekrar çalıştırılabilir).
--
-- Ofis (muhasebe bürosu) = bir yönetici hesabı + davetle katılan çalışanlar.
--  * Lisans ofisindir: çalışanlar ofis sahibinin modül lisanslarını/denemelerini kullanır (kullanıcı sınırı yok).
--  * Ofisin Luca üye numarası sabittir; program çalışanların yalnız bu üye numarasıyla Luca'ya girmesine izin verir
--    (böylece yalnız bu ofisin mükellefleriyle işlem yapılır).
--  * Davet kodu belirli bir e-posta adresine bağlıdır, 14 gün geçerlidir ve tek kullanımlıktır.
--    Kodun kendisi saklanmaz (yalnız SHA-256 özeti).
-- =====================================================================

create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  luca_uye_no text not null,
  owner uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.office_members (
  user_id uuid primary key references auth.users(id) on delete cascade,     -- bir kullanıcı tek ofiste
  office_id uuid not null references public.offices(id) on delete cascade,
  role text not null default 'calisan' check (role in ('yonetici', 'calisan')),
  joined_at timestamptz not null default now(),
  invited_by uuid
);
create index if not exists office_members_office on public.office_members(office_id);
create table if not exists public.office_invites (
  id bigserial primary key,
  office_id uuid not null references public.offices(id) on delete cascade,
  code_hash text not null unique,
  email text not null,
  role text not null default 'calisan' check (role in ('yonetici', 'calisan')),
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.office_invites enable row level security;
revoke all on public.offices, public.office_members, public.office_invites from anon, authenticated;

-- ---------- yardımcılar ----------
create or replace function public._office_of(p_uid uuid) returns public.office_members
language sql stable security definer set search_path = public as $$
  select * from public.office_members where user_id = p_uid;
$$;

-- Lisans hangi hesaptan okunur: ofis üyesiyse ofis sahibinden, değilse kendisinden
create or replace function public._license_holder(p_uid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select o.owner from public.office_members m join public.offices o on o.id = m.office_id where m.user_id = p_uid), p_uid);
$$;

create or replace function public._norm_uye(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

create or replace function public._office_json(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.office_members; o public.offices;
begin
  select * into m from public.office_members where user_id = p_uid;
  if not found then return null; end if;
  select * into o from public.offices where id = m.office_id;
  return jsonb_build_object('id', o.id, 'name', o.name, 'luca_uye_no', o.luca_uye_no, 'role', m.role,
    'is_owner', o.owner = p_uid, 'owner_email', (select email from public.profiles where id = o.owner));
end $$;

-- ---------- modül durumu: ofis üyesi ofis sahibinin lisansını kullanır ----------
create or replace function public._status_of(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; holder uuid; hp public.profiles; e jsonb; res jsonb; mods jsonb;
begin
  select * into p from public.profiles where id = p_uid;
  if not found then return jsonb_build_object('valid', false, 'reason', 'Profil bulunamadı.'); end if;
  holder := public._license_holder(p_uid);
  select * into hp from public.profiles where id = holder;
  select coalesce(jsonb_object_agg(id, public._module_status(holder, id)), '{}'::jsonb) into mods from public.modules;
  e := public._module_status(holder, 'ekstre');
  res := jsonb_build_object('email', p.email, 'reg', p.reg, 'server_time', now(),
    'trial_end', hp.trial_start + make_interval(days => hp.trial_days),
    'license_end', (select max(ends_at) from public.licenses where user_id = holder and module = 'ekstre'),
    'is_admin', exists(select 1 from public.admins where user_id = p_uid),
    'offline_days', (select (value #>> '{}')::int from public.settings where key = 'offline_days'),
    'modules', mods,
    'module_list', (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active) order by sort) from public.modules),
    'office', public._office_json(p_uid));
  if p.disabled then   -- çalışanın kendi hesabı kapatılmışsa
    return res || jsonb_build_object('valid', false, 'type', 'disabled', 'reason', 'Hesabınız kapatılmış. ' || coalesce(p.note, ''),
      'modules', (select jsonb_object_agg(k, v || jsonb_build_object('valid', false, 'type', 'disabled', 'reason', 'Hesabınız kapatılmış.')) from jsonb_each(mods) x(k, v)));
  end if;
  return res || (e - 'module' - 'name' - 'active' - 'license_end' - 'trial_end');
end $$;

-- Modül açılışı (deneme başlatma) ve kod etkinleştirme ofis sahibinin hesabına işlenir
create or replace function public.app_status(p_device text, p_name text default null, p_version text default null, p_module text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); holder uuid; maxd int; n int; em text; m public.modules;
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
  holder := public._license_holder(uid);
  if p_module is not null and p_module <> 'ekstre' then
    select * into m from public.modules where id = p_module;
    if found and m.active and not exists (select 1 from public.licenses where user_id = holder and module = p_module) then
      insert into public.module_trials(user_id, module, trial_days) values (holder, p_module, m.trial_days) on conflict do nothing;
    end if;
  end if;
  update public.profiles set last_seen = now(), app_version = coalesce(p_version, app_version) where id = uid;
  return public._status_of(uid);
end $$;

create or replace function public.activate_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); holder uuid; v text; h text; c public.license_codes; base timestamptz; mname text;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  holder := public._license_holder(uid);
  v := regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
  v := translate(v, 'ILOU', '110V');
  if length(v) <> 50 then
    return jsonb_build_object('valid', false, 'reason', 'Lisans kodu 50 haneli olmalı.');
  end if;
  h := encode(extensions.digest(v, 'sha256'), 'hex');
  select * into c from public.license_codes where code_hash = h for update;
  if not found then return jsonb_build_object('valid', false, 'reason', 'Lisans kodu geçersiz.'); end if;
  select name into mname from public.modules where id = c.module;
  if c.used_by is not null and c.used_by <> holder then
    return jsonb_build_object('valid', false, 'reason', 'Bu lisans kodu başka bir hesapta kullanılmış.');
  end if;
  if c.used_by = holder then
    return public._status_of(uid) || jsonb_build_object('note', 'Bu kod hesabınızda zaten etkin (' || coalesce(mname, c.module) || ').', 'activated_module', c.module);
  end if;
  update public.license_codes set used_by = holder, used_at = now() where code_hash = h;
  select greatest(now(), coalesce(max(ends_at), now())) into base from public.licenses where user_id = holder and module = c.module;
  insert into public.licenses(user_id, source, code_hash, starts_at, ends_at, module)
    values (holder, 'kod', h, now(), base + make_interval(days => c.days), c.module);
  return public._status_of(uid) || jsonb_build_object('activated_module', c.module,
    'note', coalesce(mname, c.module) || ' modülü lisansı ' || c.days || ' gün uzatıldı' || case when holder <> uid then ' (ofis lisansı).' else '.' end);
end $$;

-- ---------- ofis işlemleri ----------
create or replace function public.office_create(p_name text, p_luca_uye_no text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); oid uuid; uye text := public._norm_uye(p_luca_uye_no);
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  if exists (select 1 from public.office_members where user_id = uid) then raise exception 'Zaten bir ofise bağlısınız.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Ofis adını yazın.'; end if;
  if length(uye) < 3 then raise exception 'Luca üye numarasını yazın.'; end if;
  insert into public.offices(name, luca_uye_no, owner) values (trim(p_name), uye, uid) returning id into oid;
  insert into public.office_members(user_id, office_id, role) values (uid, oid, 'yonetici');
  return public._status_of(uid);
end $$;

create or replace function public.office_update(p_name text, p_luca_uye_no text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.office_members; uye text := public._norm_uye(p_luca_uye_no);
begin
  select * into m from public.office_members where user_id = uid;
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  if length(uye) < 3 then raise exception 'Luca üye numarasını yazın.'; end if;
  update public.offices set name = coalesce(nullif(trim(p_name), ''), name), luca_uye_no = uye where id = m.office_id;
  return public._status_of(uid);
end $$;

-- Davet: kodu üretir, YALNIZ BİR KEZ döndürür (saklanmaz). Aynı e-postaya önceki açık davet iptal edilir.
create or replace function public.office_invite(p_email text, p_role text default 'calisan') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); m public.office_members; em text := lower(trim(coalesce(p_email, ''))); kod text; ham text; alfabe text := '23456789ABCDEFGHJKMNPQRSTVWXYZ'; i int; o public.offices; exp timestamptz;
begin
  select * into m from public.office_members where user_id = uid;
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  if em !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Geçerli bir e-posta adresi yazın.'; end if;
  if p_role not in ('yonetici', 'calisan') then raise exception 'Geçersiz rol.'; end if;
  if exists (select 1 from public.office_members om join public.profiles pr on pr.id = om.user_id where om.office_id = m.office_id and pr.email = em) then
    raise exception 'Bu e-posta zaten ofisinizde.';
  end if;
  ham := '';
  for i in 1..12 loop ham := ham || substr(alfabe, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alfabe)), 1); end loop;
  kod := 'MW-' || substr(ham, 1, 4) || '-' || substr(ham, 5, 4) || '-' || substr(ham, 9, 4);
  update public.office_invites set revoked = true where office_id = m.office_id and email = em and used_by is null and not revoked;
  insert into public.office_invites(office_id, code_hash, email, role, created_by)
    values (m.office_id, encode(extensions.digest(ham, 'sha256'), 'hex'), em, p_role, uid) returning expires_at into exp;
  select * into o from public.offices where id = m.office_id;
  return jsonb_build_object('ok', true, 'code', kod, 'email', em, 'expires_at', exp, 'office', o.name, 'luca_uye_no', o.luca_uye_no);
end $$;

create or replace function public.office_join(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); em text; ham text; inv public.office_invites; o public.offices;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  select lower(email) into em from auth.users where id = uid;
  ham := regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
  if length(ham) = 14 and left(ham, 2) = 'MW' then ham := substr(ham, 3); end if;   -- "MW-" öneki yazılmadan da kabul
  select * into inv from public.office_invites where code_hash = encode(extensions.digest(ham, 'sha256'), 'hex') for update;
  if not found or inv.revoked then return jsonb_build_object('ok', false, 'reason', 'Davet kodu geçersiz.'); end if;
  if inv.used_by is not null then return jsonb_build_object('ok', false, 'reason', 'Bu davet kodu kullanılmış.'); end if;
  if inv.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'Davet kodunun süresi dolmuş. Ofis yöneticinizden yeni kod isteyin.'); end if;
  if inv.email <> em then return jsonb_build_object('ok', false, 'reason', 'Bu davet ' || inv.email || ' adresine gönderilmiş. Programa o adresle üye olun.'); end if;
  if exists (select 1 from public.office_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'Hesabınız zaten bir ofise bağlı.');
  end if;
  insert into public.office_members(user_id, office_id, role, invited_by) values (uid, inv.office_id, inv.role, inv.created_by);
  update public.office_invites set used_by = uid, used_at = now() where id = inv.id;
  select * into o from public.offices where id = inv.office_id;
  return public._status_of(uid) || jsonb_build_object('ok', true, 'joined', o.name);
end $$;

-- Ofis bilgisi; yöneticiye çalışanlar ve açık davetler de döner
create or replace function public.office_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.office_members; res jsonb;
begin
  select * into m from public.office_members where user_id = uid;
  if not found then return null; end if;
  res := public._office_json(uid);
  if m.role = 'yonetici' then
    res := res || jsonb_build_object(
      'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', om.user_id, 'email', p.email, 'role', om.role, 'joined_at', om.joined_at,
                    'last_seen', p.last_seen, 'disabled', p.disabled, 'is_owner', o.owner = om.user_id,
                    'name', coalesce(p.reg->>'yetkili', '')) order by om.joined_at), '[]'::jsonb)
                  from public.office_members om join public.profiles p on p.id = om.user_id join public.offices o on o.id = om.office_id
                  where om.office_id = m.office_id),
      'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'role', role, 'created_at', created_at, 'expires_at', expires_at) order by created_at desc), '[]'::jsonb)
                  from public.office_invites where office_id = m.office_id and used_by is null and not revoked and expires_at > now()));
  end if;
  return res;
end $$;

create or replace function public.office_revoke_invite(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.office_members;
begin
  select * into m from public.office_members where user_id = auth.uid();
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  update public.office_invites set revoked = true where id = p_id and office_id = m.office_id and used_by is null;
  return public.office_info();
end $$;

-- Çalışanı ofisten çıkar (hesabı kalır ama ofis lisansını ve Luca üye numarasını kullanamaz)
create or replace function public.office_remove_member(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.office_members; o public.offices;
begin
  select * into m from public.office_members where user_id = auth.uid();
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  select * into o from public.offices where id = m.office_id;
  if p_user = o.owner then raise exception 'Ofis sahibi çıkarılamaz.'; end if;
  delete from public.office_members where user_id = p_user and office_id = m.office_id;
  return public.office_info();
end $$;

create or replace function public.office_set_role(p_user uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.office_members; o public.offices;
begin
  select * into m from public.office_members where user_id = auth.uid();
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  if p_role not in ('yonetici', 'calisan') then raise exception 'Geçersiz rol.'; end if;
  select * into o from public.offices where id = m.office_id;
  if p_user = o.owner then raise exception 'Ofis sahibinin rolü değiştirilemez.'; end if;
  update public.office_members set role = p_role where user_id = p_user and office_id = m.office_id;
  return public.office_info();
end $$;

-- Yönetici (program sahibi) listesine ofis bilgisi
create or replace function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
  return coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
    select jsonb_build_object('id', p.id, 'email', p.email, 'reg', p.reg, 'created_at', p.created_at, 'last_seen', p.last_seen,
      'app_version', p.app_version, 'disabled', p.disabled, 'note', p.note,
      'confirmed', (select email_confirmed_at is not null from auth.users u where u.id = p.id),
      'devices', (select count(*) from public.devices d where d.user_id = p.id),
      'codes', (select count(*) from public.licenses l where l.user_id = p.id and l.source = 'kod')) || public._status_of(p.id) as x
    from public.profiles p) t), '[]'::jsonb);
end $$;

-- ---------- yetkiler ----------
revoke all on function public.office_create(text, text), public.office_update(text, text), public.office_invite(text, text),
  public.office_join(text), public.office_info(), public.office_revoke_invite(bigint), public.office_remove_member(uuid),
  public.office_set_role(uuid, text), public._office_of(uuid), public._license_holder(uuid), public._office_json(uuid) from public, anon;
grant execute on function public.office_create(text, text), public.office_update(text, text), public.office_invite(text, text),
  public.office_join(text), public.office_info(), public.office_revoke_invite(bigint), public.office_remove_member(uuid),
  public.office_set_role(uuid, text) to authenticated;
revoke all on function public._office_of(uuid), public._license_holder(uuid), public._office_json(uuid) from authenticated;

-- PostgREST şema önbelleğini yenile (yeni fonksiyonlar hemen görünsün)
notify pgrst, 'reload schema';
