# Muhasebe Denetimi: masaüstünden siteye geçiş planı (açık konu 8)

Hazırlayan: Web Asistanı · 24.10.2026 · Yalnız analiz; kod değişikliği yok. Taban: `main` (Görev 23 sonrası).

**Kullanıcı kararı (23.10.2026):** Modül web'de yayına alınıp denendikten sonra masaüstündeki "Muhasebe Denetimi" (eski Mikro Denetim) kaldırılır, yerine siteye yönlendiren bir kart konur.

## 0. Ön koşullar (bunlar olmadan kaldırma yapılmaz)
1. Site yayında: `https://muhawin.com.tr/denetim/` açılıyor (Cloudflare adımları, `web/CLOUDFLARE-ADIMLAR.md`).
2. Kullanıcı sitede en az bir gerçek dönemi denetleyip masaüstüyle aynı sonucu gördü (kabul denemesi).
3. Eski denetimlerini taşımak isteyenler için "dışa aktar / içe aktar" hazır (§4) ya da kullanıcı "taşımaya gerek yok" dedi.
4. Kaldırmayı içeren sürüm, siteyi işaret eden kartla birlikte yayınlanır. Kart, kaldırmadan **bir sürüm önce** "yeni: web'de de var" diye gösterilebilir.

## 1. Programdan kalkacak parçalar
| Yer | Bugün | Geçişte | Görev / oturum |
|---|---|---|---|
| `renderer/index.html` ~5011, `ISLER.ozel.k` | "Muhasebe Denetimi" kartı (`id:'mikro'`), `MDENET.show()` açar | Kart kalır, **davranışı değişir**: siteyi açar (§2). `id:'mikro'` aynı kalır; ofis listesi (`office.ozel`) ve lisans değişmez | Menü Düzenleme |
| `renderer/index.html` ~139, `#mdPanel` + `#mdFrame` | Denetim sayfasının gömüldüğü panel | Silinir | Menü Düzenleme |
| `renderer/index.html` ~5678–5694, `MDENET` | Paneli açan modül; firma listesini iframe'e gönderir | Silinir | Menü Düzenleme |
| `renderer/index.html` ~5728, ~5871 | `MDENET.hide()` çağrıları (modüle giriş, Esc ile geri) | `MDENET` ile birlikte çıkar | Menü Düzenleme |
| `renderer/index.html` ~2989, ~2996 | `faturaPdf` / `htmlPdf` mesajları | **Kalır**: Fatura Kontrol (tek firma, toplu) de kullanıyor | — |
| `fk/fatura_kontrol/web/static/denetim.html`, `beyanname.html` | Masaüstünde iframe sayfası | **Silinmez**: site derlemesi bu dosyalardan üretiliyor (`tools/site_uret.js` → `sayfaUyarla`) | — |
| `fk/fatura_kontrol/web/app.py` `/api/denetim*`, `denetim.py` | Masaüstü yan süreç uçları | **Silinmez**: site, köprüyle (`web/denetim/kopru.py`) bu uçları tarayıcıda çağırıyor. Masaüstü artık çağırmaz | — |
| `test/e2e.js` | Ofisinize Özel testi `ozel: ['cek','mikro']` kullanıyor; mikro paneli açan bir adım varsa | Kartın siteye yönlendirdiği sınanır (dış bağlantı çağrısı yakalanır); panel adımları çıkar | Menü Düzenleme |
| `OKUBENI.txt` | "Mikro Denetim" bölümleri | Yeni sürüm notu: "Muhasebe Denetimi artık muhawin.com.tr'de" | Güncelleme |

Sonuç: Python tarafında **hiçbir şey silinmez**. Kaldırma yalnız masaüstü arayüzündeki panel/modül kodudur (yaklaşık 25 satır + kart davranışı). Büyüklük: **S**.

## 2. Siteye yönlendiren kart
Kart yeri değişmez (Ofisinize Özel Çözümler içinde, aynı simge). Önerilen metin:

> **Muhasebe Denetimi** · *web'de*
> E-faturaları ve muavini yükleyin; KDV, matrah ve cari kontrolü, KDV 1 / KDV 2 beyannamesi ve çıktı raporu tarayıcınızda hazırlanır. Belgeleriniz bilgisayarınızdan çıkmaz.
> [ Sitede aç ↗ ]  ·  küçük not: "MuhaWin hesabınızla giriş yapın."

- **Tıklama:** `https://muhawin.com.tr/giris.html?geri=%2Fdenetim%2F` varsayılan tarayıcıda açılır. Mevcut güvenli yol kullanılır: ana pencerenin `setWindowOpenHandler`'ı `https:` bağlantıyı `shell.openExternal` ile açıyor (`main.js` ~124–127). Ayrıca `open-mail` IPC'si `https://` kabul ediyor. **`main.js` değişikliği gerekmez.**
- Adres tek yerde sabit tutulmalı (ör. `const SITE='https://muhawin.com.tr'`). Alan adı değişirse tek satır değişir.
- Kart, ofise `mikro` tanımlı değilse bugünkü gibi görünmez.
- İsteğe bağlı: ilk tıklamada bir kez "Muhasebe Denetimi artık web'de. Eski denetimlerinizi taşımak için **Dışa aktar**" bilgisi (§4).

## 3. Lisans geçişi
- **Değişiklik gerekmiyor.** Site, programla aynı Supabase projesini ve aynı kuralı kullanıyor (`web/site/ortak/oturum.js` → `ozelIzni(st,'mikro')`, `cloud.js` `moduleOf` ile aynı mantık): ofisin `ozel` listesinde `mikro` varsa ve TEK LİSANS geçerliyse giriş açık.
- Web girişi `p_device` boş gönderdiği için **bilgisayar sınırına sayılmaz** (Görev 15'teki 10 kullanıcı / cihaz kuralları masaüstünde kalır).
- Ofis çalışanları kendi MuhaWin hesaplarıyla girer; ofis lisansı geçerlidir (programdaki gibi `_license_holder`).
- İleride ayrı bir "web" lisansı istenirse: `modules` tablosuna yeni modül + `oturum.js`'te tek satır. Şimdilik önerilmez.

## 4. Eski denetim geçmişi taşınsın mı?
**Durum:** Masaüstündeki denetimler hesap klasöründe duruyor: `%APPDATA%\MuhaWin\hesaplar\<hesap>\fatura_kontrol\veri\firmalar\<FİRMA>\<YIL>\<AY>\` (`denetim.json`, `rapor.json`, `faturalar.zip`, muavin, red/iptal listeleri). Bu klasörler **Muhasebe İşlemleri'nin fatura kontrol raporlarıyla ortaktır.** Site ise verisini tarayıcının IndexedDB'sinde tutuyor; bilgisayardaki klasörü göremiyor.

| Seçenek | Ne olur | Artı | Eksi |
|---|---|---|---|
| **A. Taşıma yok (önerilen başlangıç)** | Masaüstündeki eski denetimler yerinde kalır; sitede yeni dönemler denetlenir | İş yok, risk yok | Eski bir dönemi sitede açmak için belgeleri yeniden yüklemek gerekir |
| **B. Dışa / içe aktar** | Masaüstünde "Denetimleri dışa aktar" bir zip hazırlar (yalnız `denetim.json` olan dönem klasörleri). Sitede "İçe aktar" bu zip'i tarayıcıda açıp IndexedDB'ye yazar | Belge yine **ağa çıkmaz** (zip kullanıcıda, açma tarayıcıda) | Programda küçük bir düğme (Yazılımcı, S) + sitede içe aktarma (Web Asistanı, S). Zip büyük olabilir (fatura ZIP'leri); tarayıcı deposu sınırı genelde yeterli |
| C. Sunucu üzerinden eşitleme | Belgeler buluta yüklenir | Bilgisayarlar arası paylaşım | **Kural ihlali** (belgeler bilgisayarda kalır, kullanıcı kararı T). Önerilmez |

**Öneri:** Kaldırma sürümünde **A**. Kullanıcı eski dönemleri sitede görmek isterse **B** ayrı küçük görev olarak yapılır. Zip, masaüstündeki klasör yapısıyla birebir olduğu için site tarafı yalnız açıp `/veri/firmalar/` altına yazmaktan ibarettir. Site köprüsü aynı `depo` düzenini kullandığından ek dönüşüm gerekmez.

Not: Sitede veriler tarayıcıya bağlıdır. Tarayıcı verisi silinince sitedeki denetim geçmişi de silinir. Sitede "Dışa aktar" (aynı zip biçimi) eklenirse kullanıcı yedek alabilir; B ile aynı iş, aynı görevde yapılabilir.

## 5. Kullanıcı açısından değişenler (sürüm notu taslağı)
- Muhasebe Denetimi artık **muhawin.com.tr** üzerinden; programdaki kart siteyi açar. MuhaWin hesabınızla girersiniz.
- Faturalar ve muavin **bilgisayarınızdan çıkmaz**; denetim tarayıcıda yapılır, sonuçlar o tarayıcıda saklanır.
- **Sitede olmayanlar:**
  - "Faturaları Luca'dan Al": Luca otomasyonu tarayıcıda çalışmaz. Faturalar Mikro'dan ya da GİB portalından XML/ZIP olarak yüklenir.
  - Fatura görüntüsü şimdilik sade görünümde açılır.
- Eski denetimler programın klasöründe durur (§4 A); istenirse taşınır (§4 B).

## 6. Önerilen sıra
1. Site yayını ve kullanıcının kabul denemesi (ön koşul 1–2).
2. **Görev (Menü Düzenleme, S):** kart → siteye yönlendirme; `#mdPanel` / `MDENET` silme; e2e güncelleme; sürüm notu.
3. (İsteğe bağlı, S + S) dışa / içe aktar (§4 B).
4. Kart, kaldırmadan bir sürüm önce "web'de de var" bağlantısıyla gösterilirse geçiş yumuşak olur. Bu durumda 2. adım iki sürüme bölünür.

## Kullanıcı kararı bekleyenler
- §4: Eski denetimler taşınsın mı (A / B)?
- §6.4: Kaldırmadan önce bir sürüm boyunca iki yol birlikte dursun mu?
- §2: Kart metni uygun mu?
