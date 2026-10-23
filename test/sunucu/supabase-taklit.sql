-- Yerel testler için Supabase'in en küçük taklidi (test/whatsapp-sunucu.mjs kullanır). Gerçek sunucuya UYGULANMAZ.
-- Roller, auth.uid() (request.jwt.claim.sub ayarından), storage.buckets ve WhatsApp'ın dayandığı ofis tabloları.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth, public to anon, authenticated, service_role;
create table auth.users(id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to public;
create table storage.buckets(id text primary key, name text, public boolean);
-- Supabase'in public şemasındaki varsayılan yetkileri
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- supabase-yonetim.sql'deki _is_admin'in yerine (yama yetkisini sınamak için)
create function public._is_admin() returns boolean language sql stable security definer set search_path = public as $$ select false $$;
-- supabase-ofis.sql'deki tabloların WhatsApp'ın kullandığı sütunları
create table public.offices(id uuid primary key default gen_random_uuid(), name text not null, owner uuid references auth.users(id), created_at timestamptz not null default now());
create table public.office_members(user_id uuid primary key references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade, role text not null default 'calisan', joined_at timestamptz not null default now());
revoke all on public.offices, public.office_members from anon, authenticated;
