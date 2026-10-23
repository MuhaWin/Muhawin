# Görev 06 – WhatsApp Sunucu Güvenliği (G-C, rapor-02 Y2, Y3, D1, D4)

**Durum:** Açık (Görev 05'ten sonra) · **Uygulayan oturum:** Yazılımcı · **Taban:** `main` · **Dal:** `gorev-06-whatsapp-guvenligi` (ortam başka dal zorunlu kılıyorsa onu kullan) · **Öncelik:** 1

## Yapılacaklar
1. **Y2:** `sunucu/supabase-whatsapp.sql` numara bağlama: başka ofise ait `phone_number_id` taşınamaz (`on conflict do nothing` + kayıt başka ofisteyse hata). Aynı ofis yeniden bağlayabilir.
2. **Y3:** `sunucu/edge/whatsapp-webhook/index.ts`: POST gövdesinde `X-Hub-Signature-256` HMAC-SHA256 doğrulaması (`WA_APP_SECRET` ortam değişkeni, ham gövde, sabit zamanlı karşılaştırma); uyuşmazsa 401. Secret tanımsızsa POST reddedilir.
3. **D4:** `WA_VERIFY_TOKEN` boşsa GET doğrulaması her zaman 403.
4. **D1:** `wa_*` fonksiyonları ve `_is_admin` için `revoke all … from public, anon` (`sunucu/supabase-whatsapp.sql`, `sunucu/supabase-yonetim.sql` yalnız revoke satırları).
5. SQL değişiklikleri **geriye uyumlu, tekrar çalıştırılabilir** (idempotent) bir yama dosyası olarak da verilsin: `sunucu/yama-06-whatsapp.sql`.
6. Testler: yerel PostgreSQL ile (rapor-02'deki gibi `auth.uid()` taklidi) Y2 senaryosu artık başarısız; edge fonksiyonu için imza doğrulama mantığı ayrı bir saf fonksiyona alınıp Deno/Node ile birim testi (ağa çıkmadan).

## Kurallar
- **Canlı Supabase'e SQL uygulamak, edge fonksiyonu yayınlamak ve `WA_APP_SECRET` secret'ını eklemek kullanıcının işidir.** Raporun sonunda kullanıcı için adım adım yap: hangi SQL dosyası Supabase SQL Editor'de çalıştırılır, secret nereden alınır (Meta App → App Secret) ve `supabase secrets set` / panelden nasıl eklenir, fonksiyon nasıl yeniden yayınlanır.
- Gerçek Meta/Supabase'e istek gönderme.

## Dokunulacak dosyalar
`sunucu/supabase-whatsapp.sql`, `sunucu/edge/whatsapp-webhook/index.ts`, `sunucu/supabase-yonetim.sql` (yalnız revoke), yeni `sunucu/yama-06-whatsapp.sql`, test dosyaları (`test/` altında).

## Kabul
- Y2 ve imza testleri geçer; mevcut testler taban sonucundan kötü değil.
- Rapor `yonetim/raporlar/rapor-06.md` (kullanıcı adımları dahil). PR başlığı `Görev 06: WhatsApp sunucu güvenliği`. PR'ı yöneticiye bildir.
