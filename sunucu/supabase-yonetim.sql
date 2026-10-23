-- =====================================================================
-- MuhaWin · Yönetim (program sahibi) modülü  — sürüm 2.8.0 / 2.9.0
-- supabase-kurulum.sql, supabase-moduller.sql ve supabase-ofis.sql'den SONRA bir kez çalıştırın
-- (Supabase → SQL Editor → New query → tamamını yapıştırın → Run). Tekrar çalıştırılabilir; kayıt silmez.
--
--  * Yönetici YALNIZ program sahibidir: settings.admin_email (bilgi@smmmantalya.com).
--    admins tablosunda başka hesap varsa çıkarılır; tüm admin_* fonksiyonları sunucuda bu hesabı denetler.
--  * Üye fatura bilgileri, yönetici notu, satış / tahsilat kayıtları, işlem günlüğü, duyuru,
--    lisans kodu partileri (kodların kendisi sunucuya gelmez, yalnız SHA-256 özetleri).
--  * 2.9.0: TEK LİSANS (bir lisans / deneme tüm modülleri açar), "Ofisinize Özel Çözümler" yalnız tanımlı ofislere,
--    Yönetim girişi şifresi (ilk şifre 55555; yalnız programdan değiştirilir, sunucuda bcrypt özeti tutulur).
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- yönetici = yalnız program sahibi ----------
insert into public.settings(key, value) values ('admin_email', '"bilgi@smmmantalya.com"'::jsonb)
  on conflict (key) do update set value = excluded.value;

create or replace function public._admin_email() returns text
language sql stable security definer set search_path = public as $$
  select lower(value #>> '{}') from public.settings where key = 'admin_email';
$$;

create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a join auth.users u on u.id = a.user_id
                 where a.user_id = auth.uid() and lower(u.email) = public._admin_email());
$$;

delete from public.admins where user_id not in (select id from auth.users where lower(email) = public._admin_email());
insert into public.admins(user_id) select id from auth.users where lower(email) = public._admin_email() on conflict do nothing;

-- ---------- yeni alanlar / tablolar ----------
alter table public.profiles add column if not exists admin_note text;                          -- yalnız yöneticinin gördüğü not
alter table public.profiles add column if not exists fatura jsonb not null default '{}'::jsonb; -- yöneticinin düzelttiği fatura bilgileri

create table if not exists public.payments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,                                   -- üye silinse de kayıt okunabilsin
  module text not null default 'ekstre',
  days int not null default 365,
  tutar numeric(14,2) not null default 0,       -- KDV hariç
  kdv_orani numeric(5,2) not null default 20,
  fatura_no text,
  fatura_tarihi date,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'odendi', 'iptal')),
  odeme_tarihi date,
  yontem text,
  note text,
  license_id bigint references public.licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists payments_user on public.payments(user_id);
create table if not exists public.admin_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  admin uuid,
  action text not null,
  target uuid,
  target_email text,
  detail jsonb
);
create index if not exists admin_log_target on public.admin_log(target);
alter table public.payments enable row level security;
alter table public.admin_log enable row level security;
revoke all on public.payments, public.admin_log from anon, authenticated;

create or replace function public._alog(p_action text, p_target uuid, p_detail jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_log(admin, action, target, target_email, detail)
  values (auth.uid(), p_action, p_target, (select email from public.profiles where id = p_target), p_detail);
$$;

create or replace function public._chk() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'Yetkisiz'; end if;
end $$;

-- ---------- üye listesi ----------
create or replace function public._admin_user_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'email', p.email, 'reg', p.reg, 'created_at', p.created_at, 'last_seen', p.last_seen,
      'app_version', p.app_version, 'disabled', p.disabled, 'note', p.note, 'admin_note', p.admin_note, 'fatura', p.fatura,
      'confirmed', (select email_confirmed_at is not null from auth.users u where u.id = p.id),
      'devices', (select count(*) from public.devices d where d.user_id = p.id),
      'codes', (select count(*) from public.licenses l where l.user_id = p.id and l.source = 'kod'),
      'paid', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments y where y.user_id = p.id and y.durum = 'odendi'),
      'due', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments y where y.user_id = p.id and y.durum = 'bekliyor'),
      'last_payment', (select max(coalesce(fatura_tarihi, created_at::date)) from public.payments y where y.user_id = p.id and y.durum <> 'iptal'))
    || public._status_of(p.id)
  from public.profiles p where p.id = p_uid;
$$;

create or replace function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return coalesce((select jsonb_agg(public._admin_user_json(p.id) order by p.created_at desc) from public.profiles p), '[]'::jsonb);
end $$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.offices; res jsonb;
begin
  perform public._chk();
  res := public._admin_user_json(p_user);
  if res is null then raise exception 'Üye bulunamadı.'; end if;
  select o2.* into o from public.office_members m join public.offices o2 on o2.id = m.office_id where m.user_id = p_user;
  return res || jsonb_build_object(
    'licenses', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'module', module, 'source', source, 'starts_at', starts_at, 'ends_at', ends_at,
                   'note', note, 'created_at', created_at) order by created_at desc), '[]'::jsonb) from public.licenses where user_id = p_user),
    'trials', (select coalesce(jsonb_agg(jsonb_build_object('module', module, 'trial_start', trial_start, 'trial_days', trial_days)), '[]'::jsonb)
                 from public.module_trials where user_id = p_user),
    'device_list', (select coalesce(jsonb_agg(jsonb_build_object('device_id', device_id, 'name', name, 'first_seen', first_seen, 'last_seen', last_seen) order by last_seen desc), '[]'::jsonb)
                 from public.devices where user_id = p_user),
    'payments', (select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) from public.payments y where y.user_id = p_user),
    'log', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'action', action, 'detail', detail) order by at desc), '[]'::jsonb)
              from (select * from public.admin_log where target = p_user order by at desc limit 60) g),
    'office_detail', case when o.id is null then null else jsonb_build_object('id', o.id, 'name', o.name, 'luca_uye_no', o.luca_uye_no,
        'owner_email', (select email from public.profiles where id = o.owner),
        'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', om.user_id, 'email', pr.email, 'role', om.role, 'is_owner', om.user_id = o.owner,
                       'last_seen', pr.last_seen) order by om.joined_at), '[]'::jsonb)
                    from public.office_members om join public.profiles pr on pr.id = om.user_id where om.office_id = o.id)) end);
end $$;

create or replace function public.admin_user_update(p_user uuid, p_reg jsonb default null, p_fatura jsonb default null, p_admin_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  update public.profiles set reg = coalesce(p_reg, reg), fatura = coalesce(p_fatura, fatura),
    admin_note = case when p_admin_note is null then admin_note else nullif(p_admin_note, '') end where id = p_user;
  if not found then raise exception 'Üye bulunamadı.'; end if;
  perform public._alog('bilgi', p_user, jsonb_strip_nulls(jsonb_build_object('reg', p_reg is not null, 'fatura', p_fatura is not null, 'not', p_admin_note is not null)));
  return public._admin_user_json(p_user);
end $$;

-- ---------- lisans / deneme / hesap işlemleri (günlüklü) ----------
create or replace function public.admin_set_trial(p_user uuid, p_days_from_now int, p_module text default 'ekstre') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  if p_module = 'ekstre' then
    update public.profiles set trial_days = greatest(0, ceil(extract(epoch from (now() + make_interval(days => p_days_from_now) - trial_start)) / 86400)::int)
      where id = p_user;
  else
    insert into public.module_trials(user_id, module, trial_start, trial_days) values (p_user, p_module, now(), greatest(0, p_days_from_now))
      on conflict (user_id, module) do update set trial_days =
        greatest(0, ceil(extract(epoch from (now() + make_interval(days => p_days_from_now) - module_trials.trial_start)) / 86400)::int);
  end if;
  perform public._alog('deneme', p_user, jsonb_build_object('modul', p_module, 'gun', p_days_from_now));
  return public._status_of(p_user);
end $$;

create or replace function public._grant(p_user uuid, p_days int, p_note text, p_module text) returns bigint
language plpgsql security definer set search_path = public as $$
declare base timestamptz; lid bigint;
begin
  if p_days is null or p_days < 1 or p_days > 3660 then raise exception 'Gün sayısı 1 ile 3660 arasında olmalı.'; end if;
  if not exists (select 1 from public.modules where id = p_module) then raise exception 'Bilinmeyen modül.'; end if;
  select greatest(now(), coalesce(max(ends_at), now())) into base from public.licenses where user_id = p_user and module = p_module;
  insert into public.licenses(user_id, source, starts_at, ends_at, note, created_by, module)
    values (p_user, 'yonetici', now(), base + make_interval(days => p_days), p_note, auth.uid(), p_module) returning id into lid;
  return lid;
end $$;

create or replace function public.admin_grant(p_user uuid, p_days int, p_note text default null, p_module text default 'ekstre') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  perform public._grant(p_user, p_days, p_note, p_module);
  perform public._alog('lisans', p_user, jsonb_build_object('modul', p_module, 'gun', p_days, 'not', p_note));
  return public._status_of(p_user);
end $$;

-- Lisans bitişini belirli bir tarihe ayarla (kısaltır ya da uzatır)
create or replace function public.admin_set_license_end(p_user uuid, p_module text, p_end date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e timestamptz := (p_end::timestamp + interval '23 hours 59 minutes') at time zone 'Europe/Istanbul'; cur timestamptz;
begin
  perform public._chk();
  if not exists (select 1 from public.modules where id = p_module) then raise exception 'Bilinmeyen modül.'; end if;
  if p_end is null or p_end > current_date + 3660 then raise exception 'Geçersiz tarih.'; end if;
  update public.licenses set ends_at = greatest(starts_at, e) where user_id = p_user and module = p_module and ends_at > e;
  select max(ends_at) into cur from public.licenses where user_id = p_user and module = p_module;
  if e > now() and (cur is null or cur < e) then
    insert into public.licenses(user_id, source, starts_at, ends_at, note, created_by, module)
      values (p_user, 'yonetici', now(), e, 'bitiş tarihi ayarlandı', auth.uid(), p_module);
  end if;
  perform public._alog('bitis', p_user, jsonb_build_object('modul', p_module, 'tarih', p_end));
  return public._status_of(p_user);
end $$;

create or replace function public.admin_end_license(p_user uuid, p_module text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  update public.licenses set ends_at = now() where user_id = p_user and ends_at > now() and (p_module is null or module = p_module);
  perform public._alog('lisans_bitir', p_user, jsonb_build_object('modul', p_module));
  return public._status_of(p_user);
end $$;

create or replace function public.admin_set_disabled(p_user uuid, p_disabled boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  if p_user = auth.uid() and p_disabled then raise exception 'Kendi hesabınızı kapatamazsınız.'; end if;
  update public.profiles set disabled = p_disabled, note = p_note where id = p_user;
  perform public._alog(case when p_disabled then 'kapat' else 'ac' end, p_user, jsonb_build_object('not', p_note));
  return public._status_of(p_user);
end $$;

create or replace function public.admin_reset_devices(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._chk();
  delete from public.devices where user_id = p_user;
  perform public._alog('pc_sifirla', p_user, null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_remove_device(p_user uuid, p_device text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform public._chk();
  delete from public.devices where user_id = p_user and device_id = p_device returning name into nm;
  perform public._alog('pc_sil', p_user, jsonb_build_object('pc', nm));
  return jsonb_build_object('ok', true);
end $$;

-- Üyeliği tamamen sil (geri alınamaz). Onay için üyenin e-postası yazılmalı. Satış kayıtları e-postasıyla kalır.
create or replace function public.admin_user_delete(p_user uuid, p_confirm_email text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare em text;
begin
  perform public._chk();
  select email into em from public.profiles where id = p_user;
  if em is null then raise exception 'Üye bulunamadı.'; end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(em) then raise exception 'Onay için üyenin e-posta adresini aynen yazın.'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabınızı silemezsiniz.'; end if;
  if exists (select 1 from public.offices where owner = p_user) then
    raise exception 'Bu üye bir ofisin sahibi. Önce ofisin çalışanlarını çıkarın ya da hesabı silmek yerine kapatın.';
  end if;
  update public.payments set email = coalesce(email, em) where user_id = p_user;
  perform public._alog('sil', p_user, jsonb_build_object('email', em));
  delete from auth.users where id = p_user;
  return jsonb_build_object('ok', true, 'email', em);
end $$;

-- ---------- satış / tahsilat ----------
create or replace function public.admin_payment_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint := nullif(p->>'id', '')::bigint; u uuid := nullif(p->>'user_id', '')::uuid; lid bigint; row_ public.payments;
  v_mod text := coalesce(nullif(p->>'module', ''), 'ekstre'); v_days int := coalesce(nullif(p->>'days', '')::int, 365);
  v_durum text := coalesce(nullif(p->>'durum', ''), 'bekliyor');
begin
  perform public._chk();
  if v_durum not in ('bekliyor', 'odendi', 'iptal') then raise exception 'Geçersiz durum.'; end if;
  if coalesce(nullif(p->>'tutar', '')::numeric, 0) < 0 then raise exception 'Tutar eksi olamaz.'; end if;
  if v_id is null then
    if u is null or not exists (select 1 from public.profiles where id = u) then raise exception 'Üye seçin.'; end if;
    if coalesce((p->>'lisans_ver')::boolean, false) and v_durum <> 'iptal' then
      lid := public._grant(u, v_days, 'satış ' || coalesce(nullif(p->>'fatura_no', ''), ''), v_mod);
    end if;
    insert into public.payments(user_id, email, module, days, tutar, kdv_orani, fatura_no, fatura_tarihi, durum, odeme_tarihi, yontem, note, license_id, created_by)
    values (u, (select email from public.profiles where id = u), v_mod, v_days, coalesce(nullif(p->>'tutar', '')::numeric, 0),
      coalesce(nullif(p->>'kdv_orani', '')::numeric, 20), nullif(p->>'fatura_no', ''), nullif(p->>'fatura_tarihi', '')::date, v_durum,
      case when v_durum = 'odendi' then coalesce(nullif(p->>'odeme_tarihi', '')::date, current_date) else nullif(p->>'odeme_tarihi', '')::date end,
      nullif(p->>'yontem', ''), nullif(p->>'note', ''), lid, auth.uid())
    returning * into row_;
    perform public._alog('satis', u, jsonb_build_object('id', row_.id, 'modul', v_mod, 'gun', v_days, 'tutar', row_.tutar, 'lisans', lid is not null));
  else
    update public.payments set module = v_mod, days = v_days, tutar = coalesce(nullif(p->>'tutar', '')::numeric, tutar),
      kdv_orani = coalesce(nullif(p->>'kdv_orani', '')::numeric, kdv_orani), fatura_no = nullif(p->>'fatura_no', ''),
      fatura_tarihi = nullif(p->>'fatura_tarihi', '')::date, durum = v_durum,
      odeme_tarihi = case when v_durum = 'odendi' then coalesce(nullif(p->>'odeme_tarihi', '')::date, odeme_tarihi, current_date) else nullif(p->>'odeme_tarihi', '')::date end,
      yontem = nullif(p->>'yontem', ''), note = nullif(p->>'note', '')
    where id = v_id returning * into row_;
    if not found then raise exception 'Kayıt bulunamadı.'; end if;
    perform public._alog('satis_duzelt', row_.user_id, jsonb_build_object('id', v_id, 'durum', v_durum));
  end if;
  return to_jsonb(row_);
end $$;

create or replace function public.admin_payment_delete(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  perform public._chk();
  delete from public.payments where id = p_id returning user_id into u;
  perform public._alog('satis_sil', u, jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_payments(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return coalesce((select jsonb_agg(to_jsonb(y) || jsonb_build_object('buro', pr.reg->>'buro', 'vkn', coalesce(pr.fatura->>'vkn', pr.reg->>'vkn'),
            'cur_email', pr.email) order by coalesce(y.fatura_tarihi, y.created_at::date) desc, y.id desc)
    from public.payments y left join public.profiles pr on pr.id = y.user_id
    where (p_from is null or coalesce(y.fatura_tarihi, y.created_at::date) >= p_from)
      and (p_to is null or coalesce(y.fatura_tarihi, y.created_at::date) <= p_to)), '[]'::jsonb);
end $$;

-- ---------- pano ----------
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ay date := date_trunc('month', current_date)::date; yil date := date_trunc('year', current_date)::date;
begin
  perform public._chk();
  return jsonb_build_object(
    'uye', (select count(*) from public.profiles),
    'yeni_ay', (select count(*) from public.profiles where created_at >= ay),
    'yeni_7', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'aktif_7', (select count(*) from public.profiles where last_seen >= now() - interval '7 days'),
    'aktif_30', (select count(*) from public.profiles where last_seen >= now() - interval '30 days'),
    'kapali', (select count(*) from public.profiles where disabled),
    'dogrulanmamis', (select count(*) from auth.users where email_confirmed_at is null),
    'ofis', (select count(*) from public.offices),
    'tahsil_ay', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments where durum = 'odendi' and coalesce(odeme_tarihi, created_at::date) >= ay),
    'tahsil_yil', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments where durum = 'odendi' and coalesce(odeme_tarihi, created_at::date) >= yil),
    'bekleyen', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments where durum = 'bekliyor'),
    'bekleyen_adet', (select count(*) from public.payments where durum = 'bekliyor'),
    'aylik', (select coalesce(jsonb_agg(jsonb_build_object('ay', to_char(a, 'YYYY-MM'),
                  'uye', (select count(*) from public.profiles where created_at >= a and created_at < a + interval '1 month'),
                  'tahsil', (select coalesce(sum(round(tutar * (1 + kdv_orani / 100), 2)), 0) from public.payments
                             where durum = 'odendi' and coalesce(odeme_tarihi, created_at::date) >= a and coalesce(odeme_tarihi, created_at::date) < a + interval '1 month'))
                  order by a), '[]'::jsonb)
              from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') a),
    'surumler', (select coalesce(jsonb_object_agg(v, n), '{}'::jsonb) from (select coalesce(app_version, '?') v, count(*) n from public.profiles
                  where last_seen >= now() - interval '30 days' group by 1) s),
    'bitecek', (select coalesce(jsonb_agg(x order by x->>'ends_at'), '[]'::jsonb) from (
                  select jsonb_build_object('user_id', l.user_id, 'email', pr.email, 'buro', pr.reg->>'buro', 'module', l.module, 'ends_at', max(l.ends_at)) x
                  from public.licenses l join public.profiles pr on pr.id = l.user_id group by l.user_id, pr.email, pr.reg, l.module
                  having max(l.ends_at) between now() and now() + interval '30 days') t),
    'son_uyeler', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'buro', reg->>'buro', 'created_at', created_at) order by created_at desc), '[]'::jsonb)
                   from (select * from public.profiles order by created_at desc limit 8) s),
    'kodlar', (select coalesce(jsonb_object_agg(module, x), '{}'::jsonb) from (
                 select module, jsonb_build_object('total', count(*), 'used', count(used_by)) x from public.license_codes group by module) t));
end $$;

-- ---------- lisans kodları (özetler program tarafında üretilir; kodun kendisi sunucuya gelmez) ----------
create or replace function public.admin_codes_add(p_hashes text[], p_days int, p_module text, p_batch text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._chk();
  if not exists (select 1 from public.modules where id = p_module) then raise exception 'Bilinmeyen modül.'; end if;
  if coalesce(array_length(p_hashes, 1), 0) = 0 or array_length(p_hashes, 1) > 2000 then raise exception 'En fazla 2000 kod.'; end if;
  if exists (select 1 from unnest(p_hashes) h where h !~ '^[0-9a-f]{64}$') then raise exception 'Geçersiz kod özeti.'; end if;
  insert into public.license_codes(code_hash, days, batch, module)
    select h, p_days, coalesce(nullif(trim(p_batch), ''), p_module || '-' || to_char(now(), 'YYYYMMDD-HH24MI')), p_module from unnest(p_hashes) h
    on conflict (code_hash) do nothing;
  get diagnostics n = row_count;
  perform public._alog('kod_uret', null, jsonb_build_object('modul', p_module, 'adet', n, 'gun', p_days, 'parti', p_batch));
  return jsonb_build_object('ok', true, 'added', n);
end $$;

create or replace function public.admin_code_lookup(p_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.license_codes;
begin
  perform public._chk();
  select * into c from public.license_codes where code_hash = lower(p_hash);
  if not found then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'module', c.module, 'days', c.days, 'batch', c.batch, 'used_at', c.used_at, 'used_by', c.used_by,
    'used_email', (select email from public.profiles where id = c.used_by));
end $$;

create or replace function public.admin_code_batches() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return coalesce((select jsonb_agg(jsonb_build_object('batch', batch, 'module', module, 'days', days, 'total', n, 'used', u) order by module, batch) from (
    select coalesce(batch, '?') batch, module, max(days) days, count(*) n, count(used_by) u from public.license_codes group by 1, 2) t), '[]'::jsonb);
end $$;

-- ---------- ayarlar ve duyuru ----------
create or replace function public.admin_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return jsonb_build_object(
    'max_devices', (select (value #>> '{}')::int from public.settings where key = 'max_devices'),
    'offline_days', (select (value #>> '{}')::int from public.settings where key = 'offline_days'),
    'admin_email', public._admin_email(),
    'duyuru', (select value from public.settings where key = 'duyuru'),
    'fiyatlar', coalesce((select value from public.settings where key = 'fiyatlar'), '{}'::jsonb),
    'modules', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active, 'trial_days', trial_days) order by sort), '[]'::jsonb) from public.modules));
end $$;

create or replace function public.admin_settings_set(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  perform public._chk();
  if p ? 'max_devices' then
    if (p->>'max_devices')::int not between 1 and 50 then raise exception 'Bilgisayar sınırı 1–50 olmalı.'; end if;
    insert into public.settings values ('max_devices', to_jsonb((p->>'max_devices')::int)) on conflict (key) do update set value = excluded.value;
  end if;
  if p ? 'offline_days' then
    if (p->>'offline_days')::int not between 1 and 30 then raise exception 'Çevrimdışı gün 1–30 olmalı.'; end if;
    insert into public.settings values ('offline_days', to_jsonb((p->>'offline_days')::int)) on conflict (key) do update set value = excluded.value;
  end if;
  if p ? 'trial_days' then
    for k, v in select * from jsonb_each_text(p->'trial_days') loop
      if v::int not between 0 and 365 then raise exception 'Deneme süresi 0–365 gün olmalı.'; end if;
      update public.modules set trial_days = v::int where id = k;
    end loop;
  end if;
  if p ? 'fiyatlar' and jsonb_typeof(p->'fiyatlar') = 'object' then
    insert into public.settings values ('fiyatlar', (select coalesce(jsonb_object_agg(key, round(value::numeric, 2)), '{}'::jsonb)
        from jsonb_each_text(p->'fiyatlar') where value ~ '^[0-9]+([.][0-9]+)?$'))
      on conflict (key) do update set value = excluded.value;
  end if;
  if p ? 'duyuru' then
    if p->'duyuru' is null or jsonb_typeof(p->'duyuru') = 'null' or coalesce(trim(p->'duyuru'->>'metin'), '') = '' then
      delete from public.settings where key = 'duyuru';
    else
      insert into public.settings values ('duyuru', jsonb_build_object('id', extract(epoch from now())::bigint, 'metin', left(trim(p->'duyuru'->>'metin'), 1000),
        'tur', coalesce(nullif(p->'duyuru'->>'tur', ''), 'bilgi'), 'bitis', nullif(p->'duyuru'->>'bitis', ''), 'tarih', now()))
        on conflict (key) do update set value = excluded.value;
    end if;
  end if;
  perform public._alog('ayar', null, p - 'duyuru' || case when p ? 'duyuru' then jsonb_build_object('duyuru', true) else '{}'::jsonb end);
  return public.admin_settings();
end $$;

-- Tüm üyeler: geçerli duyuru (program açılışında gösterilir)
create or replace function public.app_duyuru() returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = 'duyuru'
    and (value->>'bitis' is null or (value->>'bitis')::date >= current_date);
$$;

create or replace function public.admin_log_list(p_limit int default 300) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return coalesce((select jsonb_agg(jsonb_build_object('at', at, 'action', action, 'target', target, 'email', target_email, 'detail', detail) order by at desc)
    from (select * from public.admin_log order by at desc limit least(greatest(p_limit, 1), 2000)) g), '[]'::jsonb);
end $$;

-- =====================================================================
-- 2.9.0 · TEK LİSANS: hangi modülün koduyla / denemesiyle alınmış olursa olsun en uzun geçerli lisans
-- (yoksa en uzun deneme) tüm modüllerde geçerlidir. Eski sürümler de aynı durumu görür.
-- =====================================================================
create or replace function public._module_status(p_uid uuid, p_module text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; m public.modules; lic_end timestamptz; trial_end timestamptz; t2 timestamptz; t_days int;
begin
  select * into p from public.profiles where id = p_uid;
  select * into m from public.modules where id = p_module;
  if not found then return jsonb_build_object('module', p_module, 'valid', false, 'reason', 'Bilinmeyen modül.'); end if;
  if not m.active then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', false, 'valid', false, 'type', 'soon', 'reason', 'Yakında.');
  end if;
  if p.disabled then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'type', 'disabled',
      'reason', 'Hesabınız kapatılmış. ' || coalesce(p.note, ''));
  end if;
  select max(ends_at) into lic_end from public.licenses where user_id = p_uid;
  trial_end := p.trial_start + make_interval(days => p.trial_days); t_days := p.trial_days;
  select max(trial_start + make_interval(days => trial_days)) into t2 from public.module_trials where user_id = p_uid;
  if t2 is not null and t2 > trial_end then trial_end := t2; end if;
  if lic_end is not null and lic_end > now() then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', true, 'type', 'pool',
      'license_end', lic_end, 'expires', to_char(lic_end, 'YYYY-MM-DD'), 'daysLeft', ceil(extract(epoch from (lic_end - now())) / 86400)::int);
  elsif trial_end > now() and lic_end is null then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', true, 'type', 'trial',
      'trial_end', trial_end, 'expires', to_char(trial_end, 'YYYY-MM-DD'), 'daysLeft', ceil(extract(epoch from (trial_end - now())) / 86400)::int);
  elsif lic_end is not null then
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'expired', true, 'type', 'pool',
      'license_end', lic_end, 'reason', 'Lisans süresi ' || to_char(lic_end, 'DD.MM.YYYY') || ' tarihinde doldu. Yeni lisans kodu girin.');
  else
    return jsonb_build_object('module', p_module, 'name', m.name, 'active', true, 'valid', false, 'trialExpired', true, 'type', 'trial',
      'trial_end', trial_end, 'reason', 'Deneme süresi doldu. Devam etmek için lisans kodu girin.');
  end if;
end $$;

-- =====================================================================
-- 2.9.0 · "Ofisinize Özel Çözümler": yalnız yöneticinin tanımladığı ofisler (ve tüm çalışanları) görür
-- =====================================================================
alter table public.offices add column if not exists ozel text[] not null default '{}';

create or replace function public._office_json(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.office_members; o public.offices;
begin
  select * into m from public.office_members where user_id = p_uid;
  if not found then return null; end if;
  select * into o from public.offices where id = m.office_id;
  return jsonb_build_object('id', o.id, 'name', o.name, 'luca_uye_no', o.luca_uye_no, 'role', m.role,
    'is_owner', o.owner = p_uid, 'owner_email', (select email from public.profiles where id = o.owner),
    'ozel', to_jsonb(coalesce(o.ozel, '{}'::text[])));
end $$;

create or replace function public.admin_offices() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._chk();
  return coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'luca_uye_no', o.luca_uye_no, 'created_at', o.created_at,
      'owner', o.owner, 'owner_email', (select email from public.profiles where id = o.owner), 'ozel', to_jsonb(o.ozel),
      'uye', (select count(*) from public.office_members m where m.office_id = o.id)) order by o.name) from public.offices o), '[]'::jsonb);
end $$;

create or replace function public.admin_office_set_ozel(p_office uuid, p_ozel text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.offices;
begin
  perform public._chk();
  update public.offices set ozel = coalesce((select array_agg(distinct x) from unnest(p_ozel) x where x ~ '^[a-z0-9_]{2,30}$'), '{}')
    where id = p_office returning * into o;
  if not found then raise exception 'Ofis bulunamadı.'; end if;
  perform public._alog('ozel', o.owner, jsonb_build_object('ofis', o.name, 'ozel', to_jsonb(o.ozel)));
  return to_jsonb(o);
end $$;

-- =====================================================================
-- 2.9.0 · Yönetim girişi şifresi (ilk şifre 55555). Özet bcrypt ile settings.admin_pin'de; 15 dakikada 5 hatalı denemeden sonra kilit.
-- =====================================================================
create or replace function public.admin_pin_check(p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text; ok boolean; n int;
begin
  perform public._chk();
  select count(*) into n from public.admin_log where admin = auth.uid() and action = 'pin_hata' and at > now() - interval '15 minutes';
  if n >= 5 then return jsonb_build_object('ok', false, 'kilit', true, 'reason', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'); end if;
  select value #>> '{}' into h from public.settings where key = 'admin_pin';
  ok := case when h is null then coalesce(p_pin, '') = '55555' else extensions.crypt(coalesce(p_pin, ''), h) = h end;
  if not ok then perform public._alog('pin_hata', null, null); return jsonb_build_object('ok', false, 'reason', 'Şifre hatalı.', 'kalan', 4 - n); end if;
  perform public._alog('pin_giris', null, null);
  return jsonb_build_object('ok', true, 'varsayilan', h is null);
end $$;

create or replace function public.admin_pin_set(p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public._chk();
  r := public.admin_pin_check(p_old);
  if not (r->>'ok')::boolean then return r; end if;
  if coalesce(p_new, '') !~ '^\S{4,32}$' then raise exception 'Yeni şifre 4–32 karakter olmalı, boşluk içermemeli.'; end if;
  insert into public.settings values ('admin_pin', to_jsonb(extensions.crypt(p_new, extensions.gen_salt('bf'))))
    on conflict (key) do update set value = excluded.value;
  perform public._alog('pin_degisti', null, null);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- yetkiler ----------
revoke all on function public._admin_email(), public._chk(), public._alog(text, uuid, jsonb), public._admin_user_json(uuid),
  public._grant(uuid, int, text, text) from public, anon, authenticated;
revoke all on function public.admin_users(), public.admin_user_detail(uuid), public.admin_user_update(uuid, jsonb, jsonb, text),
  public.admin_set_trial(uuid, int, text), public.admin_grant(uuid, int, text, text), public.admin_set_license_end(uuid, text, date),
  public.admin_end_license(uuid, text), public.admin_set_disabled(uuid, boolean, text), public.admin_reset_devices(uuid),
  public.admin_remove_device(uuid, text), public.admin_user_delete(uuid, text), public.admin_payment_save(jsonb), public.admin_payment_delete(bigint),
  public.admin_payments(date, date), public.admin_dashboard(), public.admin_codes_add(text[], int, text, text), public.admin_code_lookup(text),
  public.admin_code_batches(), public.admin_settings(), public.admin_settings_set(jsonb), public.app_duyuru(), public.admin_log_list(int),
  public.admin_offices(), public.admin_office_set_ozel(uuid, text[]), public.admin_pin_check(text), public.admin_pin_set(text, text) from public, anon;
grant execute on function public.admin_users(), public.admin_user_detail(uuid), public.admin_user_update(uuid, jsonb, jsonb, text),
  public.admin_set_trial(uuid, int, text), public.admin_grant(uuid, int, text, text), public.admin_set_license_end(uuid, text, date),
  public.admin_end_license(uuid, text), public.admin_set_disabled(uuid, boolean, text), public.admin_reset_devices(uuid),
  public.admin_remove_device(uuid, text), public.admin_user_delete(uuid, text), public.admin_payment_save(jsonb), public.admin_payment_delete(bigint),
  public.admin_payments(date, date), public.admin_dashboard(), public.admin_codes_add(text[], int, text, text), public.admin_code_lookup(text),
  public.admin_code_batches(), public.admin_settings(), public.admin_settings_set(jsonb), public.app_duyuru(), public.admin_log_list(int),
  public.admin_offices(), public.admin_office_set_ozel(uuid, text[]), public.admin_pin_check(text), public.admin_pin_set(text, text) to authenticated;
revoke all on function public._module_status(uuid, text), public._office_json(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
