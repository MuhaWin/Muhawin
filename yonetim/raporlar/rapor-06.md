# Rapor 06 – WhatsApp Sunucu Güvenliği (G-C, rapor-02 Y2, Y3, D1, D4)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `d5cb566` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Canlı Supabase'e SQL uygulanmadı, edge fonksiyonu yayınlanmadı, Meta'ya istek gönderilmedi. Bu adımlar kullanıcının işi; aşağıda adım adım yazıldı.

## Canlı durum (kullanıcının gönderdiği şema dökümü, 23.10.2026)
`wa_numaralar`, `wa_gelen` tabloları ve `wa_*` fonksiyonları **canlıda yok**; WhatsApp özelliği henüz kurulmamış. Y2 ve Y3 bugün canlıda etkin değil. Bu iş, özellik açılmadan önce kapıyı kapatıyor. `_is_admin` canlıda var; D1'in o kısmı canlıda da uygulanmalı.

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | **Y2:** başka ofise ait numara taşınamaz, aynı ofis yeniden bağlar | Yapıldı. `on conflict … do update … where wa_numaralar.office_id = excluded.office_id` + `if not found then raise`. Yarış durumunda da güvenli (tek ifade). Ek: Phone number ID yalnız 5–30 rakam; görünen ad 40 karakterle sınırlı |
| 2 | **Y3:** `X-Hub-Signature-256` HMAC-SHA256, `WA_APP_SECRET`, ham gövde, sabit zamanlı karşılaştırma; uyuşmazsa 401; secret yoksa POST reddi | Yapıldı. İmza ham **baytlar** üzerinden hesaplanıyor (`req.arrayBuffer()`); metne çevirip yeniden kodlamak Türkçe karakterli gövdelerde Meta imzasını bozabilirdi. JSON ayrıştırma imzadan sonra |
| 3 | **D4:** `WA_VERIFY_TOKEN` boşsa GET 403 | Yapıldı (`abonelikGecerli`; karşılaştırma da sabit zamanlı) |
| 4 | **D1:** `wa_*` ve `_is_admin` için `revoke … from public, anon` | Yapıldı. `_is_admin` yalnız SECURITY DEFINER fonksiyonların içinden çağrılıyor; geri alma onları etkilemez |
| 5 | Tekrar çalıştırılabilir yama `sunucu/yama-06-whatsapp.sql` | Yapıldı. WhatsApp kurulu değilse yalnız `_is_admin` yetkisini düzeltir ve bilgi verir (canlının bugünkü durumu); kuruluysa fonksiyonu ve yetkileri düzeltir |
| 6 | Testler: yerel PostgreSQL ile Y2; saf imza fonksiyonu için birim testi | Yapıldı |

## Commit'ler
- `e35d554` Görev 06: WhatsApp numarası başka ofise taşınamaz; wa_* ve _is_admin anon'a kapalı
- `cd1db1c` Görev 06: canlı sunucu için tekrar çalıştırılabilir yama (yama-06-whatsapp.sql)
- `8efbd9c` Görev 06: webhook'ta X-Hub-Signature-256 doğrulaması
- `9f5a095` Görev 06: imza birim testi ve yerel PostgreSQL ile numara bağlama testi
- Bu raporun commit'i

## Değişen dosyalar
- `sunucu/supabase-whatsapp.sql`: `wa_numara_bagla`, yetki satırları
- `sunucu/supabase-yonetim.sql`: tek `revoke` satırı
- Yeni: `sunucu/yama-06-whatsapp.sql`
- `sunucu/edge/whatsapp-webhook/index.ts` ve yeni `imza.ts` (saf doğrulama modülü)
- Yeni testler: `test/whatsapp-imza.mjs`, `test/whatsapp-sunucu.mjs`, `test/sunucu/supabase-taklit.sql` (yalnız yerel test için en küçük Supabase taklidi; gerçek sunucuya uygulanmaz)
- Uygulama kodu (Electron, renderer, `fk/`) değişmedi

## Testler
| Test | Sonuç |
|---|---|
| `node test/whatsapp-sunucu.mjs` (yerel PostgreSQL 16) | **25/25.** Eski `supabase-whatsapp.sql` ile 3 başarısız (numara taşındı, ad değişti, geçersiz ID kabul edildi); yama iki kez üst üste çalıştırılınca eski fonksiyonu da düzeltiyor. PostgreSQL yoksa test "atlandı" der |
| `node test/whatsapp-imza.mjs` | **16/16** (Node'un `crypto.createHmac` sonucuyla karşılaştırma, Türkçe karakterli gövde, yanlış secret, boş secret, bozuk başlık, boş verify token) |
| `index.ts` / `imza.ts` sözdizimi | Node tür ayıklama + `node --check` temiz. Deno ortamda yok; fonksiyon Deno'da çalıştırılmadı |
| `node test/mobil.js` / `node test/guncelleme.js` | **42/42**, **36/36** |
| pytest, e2e | Çalıştırılmadı: uygulama kodu değişmedi (son koşu Görev 05'te: 106/2/1 ve 203/1) |

## Kalan riskler
- **Önceden sahiplenme:** İlk bağlayan ofis numarayı alır. Kötü niyetli bir ofis, başka bir ofisin Phone number ID'sini o ofisten önce bağlayabilir. Bu durumda gerçek sahip "başka bir ofise bağlı" hatası alır; fişler yine saldırgana gitmez, ama numara kullanılamaz. Phone number ID gizli değildir, ama tahmin edilmesi de zordur. Kalıcı çözüm, bağlamada Meta Graph API ile sahiplik kanıtı ya da bağlamayı yalnız yöneticinin onaylamasıdır. Şimdilik yönetici `wa_numaralar`'dan satırı silerek düzeltebilir.
- **Mevcut kayıtlar:** WhatsApp canlıda hiç kurulmadığı için yanlış taşınmış numara olamaz. Yamanın sonunda kontrol sorgusu var.
- **Deno'da çalışma:** `imza.ts` yalnız Web Crypto kullanıyor (Deno'da standart). Yine de ilk yayından sonra Meta panelindeki "Test" düğmesiyle uçtan uca denenmeli (adım 3.5).

## Kullanıcı adımları
> Sıra önemli: önce secret (adım 2), sonra fonksiyonu yayınlamak (adım 3). Secret'sız yayınlanan fonksiyon tüm Meta isteklerini 401 ile reddeder; bu güvenli, ama fişler gelmez.

### 1. SQL (bugün yapılabilir; WhatsApp kurulu olmasa da güvenli)
1. Supabase paneli → projeniz → **SQL Editor** → **New query**.
2. Depodaki `sunucu/yama-06-whatsapp.sql` dosyasının tamamını yapıştırın → **Run**.
3. WhatsApp kurulu değilse çıktıda `wa_numaralar yok: WhatsApp kurulu değil, WhatsApp kısmı atlandı.` bildirimi görünür. `_is_admin` yetkisi yine düzeltilmiştir.
4. **WhatsApp'ı ilk kez kuracağınız gün:** güncel `sunucu/supabase-whatsapp.sql` dosyasını çalıştırın (düzeltmeler içinde), ardından yamayı bir kez daha çalıştırabilirsiniz (zararsız).

### 2. `WA_APP_SECRET` (yalnız WhatsApp'ı kullanacaksanız)
1. **developers.facebook.com** → My Apps → WhatsApp uygulamanız → **App settings → Basic** → **App secret** → **Show** (Facebook şifrenizi ister) → değeri kopyalayın.
2. Secret'ı Supabase'e ekleyin; ikisinden biri yeter:
   - **Panelden:** Supabase → **Edge Functions → Secrets** (Project Settings → Edge Functions) → **Add new secret** → Name: `WA_APP_SECRET`, Value: kopyaladığınız değer → **Save**.
   - **Komut satırından:** `supabase secrets set WA_APP_SECRET=<değer> --project-ref <proje-kodu>`
3. Aynı yerde `WA_VERIFY_TOKEN`'ın dolu olduğunu kontrol edin. Boşsa artık Meta abonelik doğrulaması da başarısız olur. Kendi belirlediğiniz uzun, rastgele bir metin yazın; aynı metni Meta panelinde Webhook → **Verify token** alanına girin.
4. Secret değerini hiçbir dosyaya, mesaja ya da depoya yazmayın.

### 3. Edge fonksiyonunu yayınlamak
1. Bilgisayarınızda Supabase CLI kurulu ve projeye bağlı olmalı (`supabase login`, `supabase link --project-ref <proje-kodu>`).
2. Depoda `sunucu/edge/whatsapp-webhook/` klasörünü Supabase proje düzenine kopyalayın: `supabase/functions/whatsapp-webhook/` altında `index.ts` **ve** `imza.ts` birlikte bulunmalı.
3. `supabase functions deploy whatsapp-webhook --no-verify-jwt`
4. `whatsapp-al` fonksiyonu değişmedi; yeniden yayınlamaya gerek yok.
5. **Deneme:** Meta paneli → WhatsApp → **Configuration → Webhook** → `messages` alanının yanında **Test**. Supabase → Edge Functions → whatsapp-webhook → **Logs**'ta istek 200 görünmeli; 401 görünüyorsa App Secret yanlış ya da eksik demektir.

## Devir notu
- `imza.ts` başka webhook'larda da kullanılabilir.
- Önceden sahiplenme riskine karşı yönetim modülüne "WhatsApp numarası bağını kaldır" işlemi eklemek ayrı bir küçük görev olabilir (`admin_*` RPC + `renderer/yonetim.js`).
- Canlı şemada depoda olmayan `ofis_veri` tablosu ve fonksiyonları var. Bunların SQL'i depoya alınmalı (ayrı görev; rapor-02 ekinde ele alınacak).
