-- =====================================================================
-- MuhaWin · WhatsApp fiş kutusu (ÖKC fişleri mükelleften WhatsApp ile)
-- supabase-ofis.sql'den SONRA bir kez çalıştırın (tekrar çalıştırılabilir).
--
-- Akış: mükellef ofisin WhatsApp Business numarasına fiş fotoğrafı gönderir → Meta webhook'u Edge Function
-- "whatsapp-webhook"a düşer → görüntü Graph API'den indirilip "wa-fisler" kovasına yazılır, satır wa_gelen'e
-- eklenir, mükellefe "alındı" yanıtı gider → MuhaWin ÖKC Fiş Girişi "WhatsApp'tan Al" ile (Edge Function
-- "whatsapp-al") bekleyenleri indirir, gönderen numaraya göre firmaya düşürür, alındı işaretler.
-- Hangi WhatsApp numarasının (phone_number_id) hangi ofise ait olduğu wa_numaralar'da tutulur.
-- Gizli anahtarlar (WA_TOKEN, WA_VERIFY_TOKEN) Edge Function secret'larıdır; bu dosyada yoktur.
-- =====================================================================

create table if not exists public.wa_numaralar (
  phone_number_id text primary key,              -- Meta "Phone number ID"
  office_id uuid not null references public.offices(id) on delete cascade,
  display_phone text,
  created_at timestamptz not null default now()
);
create table if not exists public.wa_gelen (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  wa_mesaj_id text unique,                        -- Meta message id (tekrar eden webhook'lara karşı)
  telefon text not null,                          -- gönderen (905xxxxxxxxx)
  gonderen_ad text,
  metin text,
  mime text,
  dosya text,                                     -- storage yolu: wa-fisler/<office>/<id>.jpg
  zaman timestamptz not null default now(),
  alindi boolean not null default false,
  alan uuid references auth.users(id) on delete set null,
  alindi_zaman timestamptz
);
create index if not exists wa_gelen_office_bekleyen on public.wa_gelen(office_id, alindi, zaman);
alter table public.wa_numaralar enable row level security;
alter table public.wa_gelen enable row level security;
revoke all on public.wa_numaralar, public.wa_gelen from anon, authenticated;
-- Edge Function'lar service role ile yazar; kullanıcılar yalnız aşağıdaki RPC'lerle okur / işaretler.

insert into storage.buckets (id, name, public) values ('wa-fisler', 'wa-fisler', false) on conflict (id) do nothing;

-- Ofisimin bekleyen (alınmamış) fişleri
create or replace function public.wa_bekleyenler() returns setof public.wa_gelen
language sql stable security definer set search_path = public as $$
  select g.* from public.wa_gelen g
  where g.office_id = (select office_id from public.office_members where user_id = auth.uid())
    and not g.alindi
  order by g.zaman;
$$;

-- Alındı işaretle (MuhaWin'e indirildi)
create or replace function public.wa_alindi(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.wa_gelen set alindi = true, alan = auth.uid(), alindi_zaman = now()
   where id = any(p_ids) and office_id = (select office_id from public.office_members where user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- Ofis yöneticisi: WhatsApp numarasını ofise bağla (Meta panelindeki Phone number ID).
-- Başka ofise bağlı numara taşınamaz (aksi hâlde o numaraya gelen fişler bu ofise akardı); aynı ofis yeniden bağlayabilir.
create or replace function public.wa_numara_bagla(p_phone_number_id text, p_display text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.office_members;
begin
  select * into m from public.office_members where user_id = auth.uid();
  if m.user_id is null or m.role <> 'yonetici' then raise exception 'Yalnız ofis yöneticisi bağlayabilir.'; end if;
  if coalesce(p_phone_number_id, '') !~ '^[0-9]{5,30}$' then raise exception 'Geçersiz Phone number ID.'; end if;
  insert into public.wa_numaralar(phone_number_id, office_id, display_phone) values (p_phone_number_id, m.office_id, left(p_display, 40))
    on conflict (phone_number_id) do update set display_phone = excluded.display_phone
    where wa_numaralar.office_id = excluded.office_id;
  if not found then raise exception 'Bu WhatsApp numarası başka bir ofise bağlı. Yanlışlık varsa MuhaWin destek ile iletişime geçin.'; end if;
end $$;

create or replace function public.wa_numaram() returns setof public.wa_numaralar
language sql stable security definer set search_path = public as $$
  select * from public.wa_numaralar where office_id = (select office_id from public.office_members where user_id = auth.uid());
$$;

revoke all on function public.wa_bekleyenler(), public.wa_alindi(uuid[]), public.wa_numara_bagla(text, text), public.wa_numaram() from public, anon;
grant execute on function public.wa_bekleyenler(), public.wa_alindi(uuid[]), public.wa_numara_bagla(text, text), public.wa_numaram() to authenticated;
