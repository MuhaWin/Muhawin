-- =====================================================================
-- MuhaWin · Yama 15: lisans ve ofis sıkılaştırma (rapor-02 O4, O7, D2, D3, D8, E5)
-- Supabase → SQL Editor'de bir kez çalıştırın. Tekrar çalıştırılabilir; veri silmez.
-- Fonksiyon gövdeleri canlı sunucudaki hâllerinden (23.10.2026 şema dökümü) türetildi; değişen yerler "Yama 15" ile işaretli.
--  · O4  Modül denemeleri zincirlenmez: otomatik açılan modül denemesi hesabın kendi deneme başlangıcından sayılır.
--        (Yönetimdeki "deneme uzat" işlemi eskisi gibi çalışır.)
--  · O7  Ofis başına en fazla 10 kullanıcı (yönetici dahil). Ayar: settings 'ofis_kullanici_siniri'.
--  · D2  Lisans kodu ve davet kodu girişinde 15 dakikada en fazla 10 hatalı deneme (kullanıcı başına).
--  · D3  Davet kodu başka hesapta denenince davet edilen e-posta gösterilmez.
--  · D8  app_status: cihaz kimliği / adı / sürüm uzunluk sınırı. E5: save_registration en fazla 20 KB.
-- =====================================================================

-- ---------- ayarlar ----------
-- Sınırı değiştirmek: update public.settings set value = '15' where key = 'ofis_kullanici_siniri';
insert into public.settings(key, value) values ('ofis_kullanici_siniri', '10') on conflict (key) do nothing;

-- ---------- D2: hatalı kod denemeleri ----------
create table if not exists public.kod_denemeleri (
  user_id uuid not null,
  tur     text not null,                  -- 'lisans' | 'davet'
  zaman   timestamptz not null default now()
);
create index if not exists kod_denemeleri_kullanici on public.kod_denemeleri (user_id, tur, zaman);
alter table public.kod_denemeleri enable row level security;
revoke all on public.kod_denemeleri from anon, authenticated;

create or replace function public._kod_deneme_kontrol(p_uid uuid, p_tur text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.kod_denemeleri where zaman < now() - interval '1 day';
  if (select count(*) from public.kod_denemeleri where user_id = p_uid and tur = p_tur and zaman > now() - interval '15 minutes') >= 10 then
    raise exception 'Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.';
  end if;
end $$;

create or replace function public._kod_deneme_yaz(p_uid uuid, p_tur text) returns void
language sql security definer set search_path = public as $$
  insert into public.kod_denemeleri(user_id, tur) values (p_uid, p_tur);
$$;

-- ---------- O7: ofis kullanıcı sınırı ----------
create or replace function public._ofis_siniri() returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, coalesce((select (value #>> '{}')::int from public.settings where key = 'ofis_kullanici_siniri'), 10));
$$;

-- ---------- app_status (O4, D8) ----------
create or replace function public.app_status(p_device text, p_name text default null, p_version text default null, p_module text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); holder uuid; maxd int; n int; em text; m public.modules; t0 timestamptz;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  -- Yama 15 (D8): istemciden gelen metinler sınırlı
  p_device := left(p_device, 100); p_name := left(p_name, 100); p_version := left(p_version, 30);
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
      -- Yama 15 (O4): tek deneme. Modül denemesi bugünden değil hesabın deneme başlangıcından sayılır; modül değiştirerek
      -- deneme uzamaz. (Yönetimin admin_set_trial ile verdiği uzatmalar module_trials üzerinden eskisi gibi geçerli.)
      select trial_start into t0 from public.profiles where id = holder;
      insert into public.module_trials(user_id, module, trial_start, trial_days)
        values (holder, p_module, coalesce(t0, now()), m.trial_days) on conflict do nothing;
    end if;
  end if;
  update public.profiles set last_seen = now(), app_version = coalesce(p_version, app_version) where id = uid;
  return public._status_of(uid);
end $$;

-- ---------- activate_code (D2) ----------
create or replace function public.activate_code(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); holder uuid; v text; h text; c public.license_codes; base timestamptz; mname text;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  perform public._kod_deneme_kontrol(uid, 'lisans');                     -- Yama 15 (D2)
  holder := public._license_holder(uid);
  v := regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
  v := translate(v, 'ILOU', '110V');
  if length(v) <> 50 then
    return jsonb_build_object('valid', false, 'reason', 'Lisans kodu 50 haneli olmalı.');
  end if;
  h := encode(extensions.digest(v, 'sha256'), 'hex');
  select * into c from public.license_codes where code_hash = h for update;
  if not found then
    perform public._kod_deneme_yaz(uid, 'lisans');                       -- Yama 15 (D2)
    return jsonb_build_object('valid', false, 'reason', 'Lisans kodu geçersiz.');
  end if;
  select name into mname from public.modules where id = c.module;
  if c.used_by is not null and c.used_by <> holder then
    perform public._kod_deneme_yaz(uid, 'lisans');                       -- Yama 15 (D2)
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

-- ---------- office_join (D2, D3, O7) ----------
create or replace function public.office_join(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text; ham text; inv public.office_invites; o public.offices;
begin
  if uid is null then raise exception 'Giriş gerekli'; end if;
  perform public._kod_deneme_kontrol(uid, 'davet');                      -- Yama 15 (D2)
  select lower(email) into em from auth.users where id = uid;
  ham := regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g');
  if length(ham) = 14 and left(ham, 2) = 'MW' then ham := substr(ham, 3); end if;
  select * into inv from public.office_invites where code_hash = encode(extensions.digest(ham, 'sha256'), 'hex') for update;
  if not found or inv.revoked then
    perform public._kod_deneme_yaz(uid, 'davet');                        -- Yama 15 (D2)
    return jsonb_build_object('ok', false, 'reason', 'Davet kodu geçersiz.');
  end if;
  if inv.used_by is not null then return jsonb_build_object('ok', false, 'reason', 'Bu davet kodu kullanılmış.'); end if;
  if inv.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'Davet kodunun süresi dolmuş. Ofis yöneticinizden yeni kod isteyin.'); end if;
  if inv.email <> em then
    perform public._kod_deneme_yaz(uid, 'davet');                        -- Yama 15 (D2, D3: davet edilen e-posta gösterilmez)
    return jsonb_build_object('ok', false, 'reason', 'Bu davet kodu başka bir e-posta adresine gönderilmiş. Programa davetin gönderildiği adresle üye olun.');
  end if;
  if exists (select 1 from public.office_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'reason', 'Hesabınız zaten bir ofise bağlı.');
  end if;
  -- Yama 15 (O7): ofis kullanıcı sınırı (aynı anda katılımlar sırayla sayılır)
  perform 1 from public.offices where id = inv.office_id for update;
  if (select count(*) from public.office_members where office_id = inv.office_id) >= public._ofis_siniri() then
    return jsonb_build_object('ok', false, 'reason', 'Ofis kullanıcı sınırına (' || public._ofis_siniri() || ') ulaştı. Ofis yöneticinize başvurun.');
  end if;
  insert into public.office_members(user_id, office_id, role, invited_by) values (uid, inv.office_id, inv.role, inv.created_by);
  update public.office_invites set used_by = uid, used_at = now() where id = inv.id;
  select * into o from public.offices where id = inv.office_id;
  return public._status_of(uid) || jsonb_build_object('ok', true, 'joined', o.name);
end $$;

-- ---------- office_invite (O7: sınır doluysa davet üretilmez) ----------
create or replace function public.office_invite(p_email text, p_role text default 'calisan') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); m public.office_members; em text := lower(trim(coalesce(p_email, ''))); kod text; ham text; alfabe text := '23456789ABCDEFGHJKMNPQRSTVWXYZ'; i int; o public.offices; exp timestamptz;
begin
  select * into m from public.office_members where user_id = uid;
  if not found or m.role <> 'yonetici' then raise exception 'Bu işlem için ofis yöneticisi olmalısınız.'; end if;
  if em !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Geçerli bir e-posta adresi yazın.'; end if;
  if p_role not in ('yonetici', 'calisan') then raise exception 'Geçersiz rol.'; end if;
  if exists (select 1 from public.office_members om join public.profiles pr on pr.id = om.user_id where om.office_id = m.office_id and pr.email = em) then
    raise exception 'Bu e-posta zaten ofisinizde.';
  end if;
  -- Yama 15 (O7)
  if (select count(*) from public.office_members where office_id = m.office_id) >= public._ofis_siniri() then
    raise exception 'Ofis kullanıcı sınırına (%) ulaştınız. Yeni kişi eklemek için önce bir kullanıcıyı ofisten çıkarın.', public._ofis_siniri();
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

-- ---------- save_registration (E5) ----------
create or replace function public.save_registration(p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli'; end if;
  if octet_length(coalesce(p_reg, '{}'::jsonb)::text) > 20000 then raise exception 'Kayıt bilgisi çok büyük.'; end if;   -- Yama 15 (E5)
  update public.profiles set reg = coalesce(p_reg, '{}'::jsonb) where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- yetkiler ----------
revoke all on function public._kod_deneme_kontrol(uuid, text), public._kod_deneme_yaz(uuid, text), public._ofis_siniri() from public, anon, authenticated;
revoke all on function public.app_status(text, text, text, text), public.activate_code(text), public.office_join(text),
  public.office_invite(text, text), public.save_registration(jsonb) from public, anon;
grant execute on function public.app_status(text, text, text, text), public.activate_code(text), public.office_join(text),
  public.office_invite(text, text), public.save_registration(jsonb) to authenticated;

notify pgrst, 'reload schema';
