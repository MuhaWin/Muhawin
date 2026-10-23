-- Yerel testler için Supabase platformu + supabase-kurulum.sql taklidi (depoda olmayan kurulum dosyasının tablo biçimleri,
-- canlı şema dökümünden ve kullanımdan çıkarıldı). test/lisans-sunucu.mjs kullanır. Gerçek sunucuya UYGULANMAZ.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema extensions; create schema storage;
create extension pgcrypto schema extensions;
grant usage on schema auth, public, extensions to anon, authenticated, service_role;
create table auth.users(id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to public;
create table storage.buckets(id text primary key, name text, public boolean);
-- Supabase default privileges in public schema
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- kurulum stand-in
create table public.settings(key text primary key, value jsonb);
create table public.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, email text, reg jsonb not null default '{}', created_at timestamptz not null default now(),
  last_seen timestamptz, app_version text, disabled boolean not null default false, note text, trial_start timestamptz not null default now(), trial_days int not null default 7);
create table public.licenses(id bigserial primary key, user_id uuid references auth.users(id) on delete cascade, source text, code_hash text, starts_at timestamptz, ends_at timestamptz,
  note text, created_by uuid, created_at timestamptz not null default now());
create table public.license_codes(code_hash text primary key, days int not null default 365, batch text, used_by uuid, used_at timestamptz);
create table public.devices(user_id uuid references auth.users(id) on delete cascade, device_id text, name text, first_seen timestamptz default now(), last_seen timestamptz default now(), primary key(user_id, device_id));
do $$ declare t text; begin foreach t in array array['settings','admins','profiles','licenses','license_codes','devices'] loop
  execute format('alter table public.%I enable row level security', t); execute format('revoke all on public.%I from anon, authenticated', t); end loop; end $$;
create function public._is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admins where user_id = auth.uid()) $$;
insert into public.settings values ('max_devices','2'),('offline_days','3');
