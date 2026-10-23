-- =====================================================================
-- MuhaWin · Yama 06: WhatsApp sunucu güvenliği (rapor-02 Y2, D1)
-- Supabase → SQL Editor'de bir kez çalıştırın. Tekrar çalıştırılabilir; veri silmez.
--  · WhatsApp kurulu DEĞİLSE (wa_numaralar tablosu yoksa) yama yalnız _is_admin yetkisini düzeltir;
--    WhatsApp'ı kuracağınız gün güncel sunucu/supabase-whatsapp.sql dosyasını çalıştırın (düzeltmeler içinde).
--  · Kuruluysa: başka ofise bağlı numara artık taşınamaz; wa_* fonksiyonları anon'a kapalı.
-- =====================================================================

-- D1: _is_admin yalnız SECURITY DEFINER fonksiyonların içinden çağrılır; anon / public doğrudan çağıramaz
revoke all on function public._is_admin() from public, anon;

do $yama$
begin
  if to_regclass('public.wa_numaralar') is null then
    raise notice 'wa_numaralar yok: WhatsApp kurulu değil, WhatsApp kısmı atlandı.';
    return;
  end if;

  -- Y2: başka ofise ait phone_number_id taşınamaz; aynı ofis yeniden bağlayabilir
  execute $f$
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
$f$;

  -- D1: wa_* fonksiyonları yalnız giriş yapmış kullanıcılara
  revoke all on function public.wa_bekleyenler(), public.wa_alindi(uuid[]), public.wa_numara_bagla(text, text), public.wa_numaram() from public, anon;
  grant execute on function public.wa_bekleyenler(), public.wa_alindi(uuid[]), public.wa_numara_bagla(text, text), public.wa_numaram() to authenticated;
end
$yama$;

-- Bilgi: yama öncesi açık nedeniyle bir numara yanlış ofise taşınmış olabilir. Kontrol için:
--   select n.phone_number_id, n.display_phone, o.name, n.created_at from public.wa_numaralar n join public.offices o on o.id = n.office_id order by n.created_at;

notify pgrst, 'reload schema';
