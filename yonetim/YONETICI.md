# MuhaWin – Yönetici Belgesi

Bu belgenin sahibi yönetici oturumudur. Diğer oturumlar belgeyi **okur, değiştirmez**; önerilerini raporlarına yazar.
Belge 23.10.2026'da Cowork projesinden ("Luca Fatura Muavin Kontrolü") depoya taşındı. Cowork projesi artık arşivdir; güncel kaynak bu klasördür.

## Roller ve oturumlar (tümü Code bölümünde, `MuhaWin/Muhawin` deposuna bağlı)
- **Yönetici:** İşleri parçalara böler ve her parça için görev kartı yazar (`yonetim/gorevler/gorev-NN-<konu>.md`). PR'ları inceler, kabul ya da ret kararı verir, kabul edilenleri birleştirir. `yonetim/` klasörünü günceller.
- **Yazılımcı** (eski adı "Ana Depo 2"; `session_01HKMyx49yrftMV598oVTfLH`):
  - Menü düzeni dışındaki **tüm yazılım görevlerini** uygular (kullanıcı kararı, 23.10.2026). Görev kartı kurallarıyla çalışır: kendi dalı, PR, rapor.
  - Depo ve test ortamı bakımını üstlenir.
  - Derleme ve sürüm yayınlama artık Güncelleme oturumunun işidir.
  - Eski 75 commit'lik geçmiş, Cowork'teki ilk "Ana depo" oturumunda arşiv olarak duruyor; GitHub'a taşınmadı.
- **Güncelleme** (kalıcı işçi, oturum adı "Güncelleme"): Programı derler, deneme sürümünü kullanıcıya gönderir ya da `muhawin/muhawin-surumler` deposuna yayınlar. Kartı: `gorevler/guncelleyici.md`. Yönetici her derleme için kartın "İş kayıtları" tablosuna bir satır ekler. Kullanıcı oturumu açıp şunu yazar: `Güncelleme oturumusun. yonetim/YONETICI.md ve yonetim/gorevler/guncelleyici.md dosyalarını oku, açık işi uygula.`
- **Menü Düzenleme:** Menü düzeni görevleri (Görev 01 ve devamı).
- **Web Asistanı** (`session_01GmVYe6iE3V7psTH1xXFUiq`): Alan adı, barındırma, tanıtım sitesi ve web modülleri (Görev 04 ve devamı).
- **İşçi:** Tek bir görev kartını uygular. Kullanıcı kararı (23.10.2026): Yönetici altındaki oturumlar: **Yazılımcı**, **Güncelleme**, **Menü Düzenleme**, **Web Asistanı**. Yeni görevler bu oturumlara verilir; yönetici işi oturuma doğrudan mesajla iletir. Kendi dalında çalışır, PR açar ve raporunu `yonetim/raporlar/rapor-NN.md` dosyasına yazar (aynı PR içinde).

## Klasör düzeni
- `yonetim/YONETICI.md`: bu belge.
- `yonetim/gorevler/`: görev kartları.
- `yonetim/raporlar/`: işçi raporları (Yazılımcı, Güncelleme, Menü Düzenleme; eski Ana Depo raporu).
- `yonetim/belgeler/`: durum, mimari özeti, tasarımlar, araştırmalar.

## İşleyiş
1. Yönetici görev kartını yazar ve `main` dalına commit eder. Yalnız `yonetim/` klasöründe doğrudan commit yapma hakkı vardır.
2. Kullanıcı işçi oturumunu depo seçili olarak açar ve şunu yazar: `Görev NN'in işçisisin. yonetim/YONETICI.md ve yonetim/gorevler/gorev-NN-*.md dosyalarını oku, uygula.`
3. İşçi `gorev-NN-<konu>` dalında çalışır, testleri çalıştırır, push eder ve PR açar.
4. Yönetici PR'ı inceler (diff, testler, kapsam) ve PR'a yorum yazar: `KABUL` ya da `RET + gerekçe`. Kabul edilen PR **squash merge** ile birleştirilir.
5. Paralel çalışma yalnız farklı dosyalara dokunan görevlerde yapılır. Aynı dosyaya dokunan görevler sırayla yürür. Bu dosyalar: `renderer/index.html`, `luca.js`, `main.js`, `fk/fatura_kontrol/web/toplu_api.py`. Sıradaki görev, önceki merge'ten sonra `main` üzerine rebase edilir.
6. Kullanıcıya derlenmiş sürüm gerektiğinde yönetici `gorevler/guncelleyici.md` tablosuna iş yazar; Güncelleme oturumu `main` dalını derler. Sürüm commit'i (`package.json` sürümü + OKUBENI) `surum-<sürüm>` dalından PR ile gelir. Yayın dosyaları `muhawin/muhawin-surumler` deposuna yüklenir.

## İşçi oturum kuralları
Her işçi oturumu başladığında bu bölümü okur ve tüm kurallara uyar.

1. **Hitap ve dolgu kelimesi yok.** Yanıt doğrudan işle başlar. Selamlama, "Tabii", "Hemen yapıyorum", "Elbette", teşekkür, özet tekrarı ve kapanış cümlesi yazılmaz. Amaç token tasarrufudur.
2. **En fazla 20 kullanıcı mesajı.** Her yanıtın son satırı `[mesaj N/20]` olur.
   - 17. mesajda devir notuyla birlikte raporu yazmaya başla.
   - 19. mesajda commit et, push et ve PR aç.
   - 20. mesajda yeni iş alma; kullanıcıya "Oturum sınırı doldu, yeni işçi oturumu açın" de.
   - Devam eden bir işi yarım bırakma; sınır yaklaşınca işi küçült.
3. **GitHub kuralları:**
   - Yalnız kendi `gorev-NN-*` dalına push et (Güncelleme oturumu: `surum-<sürüm>`).
   - `main` dalına push, force-push, merge ya da etiket yapma.
   - PR başlığı `Görev NN: <konu>` biçiminde olur. Açıklamada test sonuçları (sayılarla) ve rapor yolu bulunur.
4. **`yonetim/` klasörüne yalnız kendi rapor dosyanı yaz.** YONETICI.md ve görev kartlarını değiştirme.
5. **Değişmez proje kuralları** (`belgeler/ana-depo-ozet.md` §3):
   - Derleme yalnız kullanıcı isterse yapılır.
   - Şifre, token ve gizli dosya (`GIZLI-*`) commit edilmez.
   - Müşteri verisi commit edilmez.
   - Captcha'yı ve geri alınamaz işlemleri kullanıcı yapar.

<!-- Yeni kurallar kullanıcıdan geldikçe sırayla eklenecek. -->

## Görev kayıtları
| No | Konu | Kart | Durum |
|---|---|---|---|
| 01 | Menü düzeni (**B: üstte modül sekmeleri**, kullanıcı kararı) | `gorevler/gorev-01-menu-duzeni.md` | **Birleştirildi** ([#13](https://github.com/MuhaWin/Muhawin/pull/13)), Menü Düzenleme. Rapor: `raporlar/rapor-01.md`. 1. senaryonun sonu sahte örnek verilerle yeniden denenecek |
| 02 | Güvenlik denetimi (yalnız okuma) | `gorevler/gorev-02-guvenlik-denetimi.md` | **Birleştirildi** ([#9](https://github.com/MuhaWin/Muhawin/pull/9)). Rapor: `raporlar/rapor-02.md` (Kritik 1, Yüksek 3, Orta 11, Düşük 16) |
| 03 | Açılışta güncelleme sorusu ("Şimdi kur / Sonra") | `gorevler/gorev-03-guncelleme-sorusu.md` | **Birleştirildi** ([#6](https://github.com/MuhaWin/Muhawin/pull/6)). Rapor: `raporlar/rapor-03.md`. Kurulu programda deneme ilk yayından sonra |
| 04 | Alan adı, barındırma, tanıtım sitesi, web modülleri analizi | `gorevler/gorev-04-web-sitesi.md` | **Birleştirildi** ([#16](https://github.com/MuhaWin/Muhawin/pull/16)), Web Asistanı. Site `web/site/`. Kullanıcı kararı: belgeler **tarayıcıda** işlenir; alan adı alınacak (`muhawin.com.tr` + Cloudflare) |
| 05 | Fatura görüntüleme güvenliği | `gorevler/gorev-05-fatura-goruntu-guvenligi.md` | **Birleştirildi** ([#15](https://github.com/MuhaWin/Muhawin/pull/15)) |
| 07 | Canlı `ofis_veri` tablosu depoya + yetki düzeltmesi | (rapor-07) | **Birleştirildi** ([#20](https://github.com/MuhaWin/Muhawin/pull/20)). Canlıya uygulama kullanıcıda (acil değil; tablo programda kullanılmıyor) |
| 08 | Rapor kaydı ayrımı + Muhasebe Denetimi'nde program seçimi | `gorevler/gorev-08-rapor-kayit-ayrimi.md` | **Birleştirildi** ([#26](https://github.com/MuhaWin/Muhawin/pull/26)), Yazılımcı |
| 11 | Sahte örnek test dosyaları | `gorevler/gorev-11-sahte-ornek-veriler.md` | **Birleştirildi** ([#31](https://github.com/MuhaWin/Muhawin/pull/31)). e2e 263/0, pytest 115/0/1 |
| 12 | PDF okuyucu güvenliği (rapor-02 G-B, Y1: `isEvalSupported:false`, pdf.js yükseltme) | (Yazılımcı'ya mesajla; rapor-12) | Açık. Yazılımcı |
| 09 | Web: Muhasebe Denetimi tarayıcıda + site girişi | `gorevler/gorev-09-web-mikro-denetim.md` | **Birleştirildi** ([#23](https://github.com/MuhaWin/Muhawin/pull/23)), Web Asistanı. Ad düzeltmeleri [#25](https://github.com/MuhaWin/Muhawin/pull/25). Alan adı `muhawin.com.tr` **alındı** (Hostinger, 23.10.2026); Cloudflare kurulumu ve ilk yayın sürüyor |
| 06 | WhatsApp sunucu güvenliği (rapor-02 G-C) | `gorevler/gorev-06-whatsapp-sunucu-guvenligi.md` | **Birleştirildi** ([#18](https://github.com/MuhaWin/Muhawin/pull/18)). WhatsApp canlıda kurulu değil; kurulumda rapor-06 adımları |
| 10 | "Hızlı Fiş Girişi" → "Belgeden Fiş"; "Mikro Denetim" → "Muhasebe Denetimi" | `gorevler/gorev-10-belgeden-fis-adi.md` | **Birleştirildi** ([#30](https://github.com/MuhaWin/Muhawin/pull/30)), Menü Düzenleme; adlar kullanıcı onaylı |
| 13 | Mobil yönetim paneli: `MuhaWin/Muhawin-yonetim-` ile otomatik eşitleme, D5 düzeltmesi | `gorevler/gorev-13-mobil-yonetim.md` | Açık. Web Asistanı |
| 17–22 | Gece planı (arayüz, butonlar, toplu kontrol, muavin, kural, cari öneri) | `gorevler/gece-23-10.md` | Açık |
| G | Derleme ve yayın (kalıcı) | `gorevler/guncelleyici.md` | İş akışı `.github/workflows/surum.yml`. **G-02 açık:** `test/guncelleme.js` iş akışına + testler açık deneme çalıştırması (yayın yok). **G-01 tamam:** 2.9.13 deneme derlendi ([#21](https://github.com/MuhaWin/Muhawin/pull/21), run 40018199927), kullanıcıya bağlantı verildi; `v2.9.13` etiketi konmaz. İlk yayın 2.9.14+ |
| 51 | Ofis ortak verisi: kurallar/firmalar/büro bilgileri Supabase'de, fatura–muavin verisi için seçilebilir (ortak) klasör + güvenli yenileme, işlem günlüğü | Menü Düzenleme · `belgeler/bulut-veri-tasarimi.md` | Başladı (24.10.2026). **2.9.17'ye girecek; 2.9.16 derlenene kadar main'e birleştirilmez.** Kararlar: silme/değiştirme yetkisi tüm çalışanlarda (canlıdaki yalnız-yönetici kuralı için SQL yaması, kullanıcı onayıyla); Luca giriş bilgisi yerelde kalır; günlük silinemez, ofisteki herkes görür |

## Sürüm planı
- **Kural (kullanıcı kararı, 24.10.2026):** Program ve site düzeltmeleri toplu toplu `main`'e birleştirilir. Kullanıcı "artık programı güncelleyebiliriz" diyene kadar **hiçbir derleme yapılmaz**: exe, deneme sürümü, güncelleme ya da yayın yok (Actions'ta `surum.yml` elle çalıştırılmaz, `v*` etiketi konmaz). Kullanıcı karar verince yeni sürüm birlikte konuşulup oluşturulur. İşçiler her işte kendi testlerini çalıştırıp çalıştığını doğrular (derleme yapmadan). Deneme sürümü yalnız kullanıcı "deneme sürümü hazırlayın" derse yapılır.
- **2.9.13 (G-01, deneme):** Kullanıcı programın son halini denemek istedi (23.10.2026). `main`'in bugünkü hali derlenir ve yalnız kullanıcıya gönderilir; GitHub'a yayınlanmaz.
- **İlk yayın (2.9.14 ya da sonrası):** Görev 01 ve Görev 03 birleştirildikten **ve** sürüm deposu taşındıktan (açık konu 4) sonra derlenir ve `muhawin/muhawin-surumler` deposuna yayınlanır. Kurulu programlar bu sürümü kendiliğinden bulur. Görev 03'ün "Şimdi kur / Sonra" sorusu, bu sürüm kurulduktan **sonraki** yayında görülür (soru, kurulu sürümün kodunda olmalı).

## Açık konular
1. **Luca sayfa yönetimi** (rapor-01 madde 4, Görev 01 kapsamı dışında kaldı): "Luca'da Çalış" ayrı pencerede açılsın; aynı anda ek bir iş başlarsa yeni Luca sayfası açılsın. Bu iş `luca.js` ve Playwright'a dokunuyor. Görev 01 birleştirildi; Yazılımcı'nın güvenlik sırasından sonra ayrı görev olarak açılacak.
2. ~~**`test/ornek/`** gerçek müşteri verisi olabilir~~ → **Kapandı** (Görev 11): depodaki örnek dosyalar sahte veriden üretiliyor.
3. **Hesap geçişi:** Kullanıcı Team hesabından kişisel Max 20x hesabına geçmeyi düşünüyor. Depo hesaptan bağımsız; geçişte yalnız GitHub bağlantısı yeniden kurulur. Max planında Claude Code "Projects" özelliği de var; bu düzen için uygun.
4. **Sürüm deposu taşınıyor** (23.10.2026): `McLk007/muhawin-surumler` → `muhawin/muhawin-surumler`. `package.json` → `build.publish` güncellendi. Kurulu sürümler adresi derlemede `app-update.yml`'ye yazılmış haliyle (eski depo) arar. **Karar:** Eski depo GitHub "Transfer ownership" ile taşınacak; GitHub yönlendirmesi sayesinde köprü sürüm gerekmez. Yeni açılan boş depo önce silinecek ya da yeniden adlandırılacak (ad çakışması). Taşımadan sonra `McLk007` altında aynı adla depo açılmamalı, depo herkese açık kalmalı. 2.9.4 öncesinde otomatik güncelleme yok, elle kurulur. **Kullanıcı yapacak; sonra doğrulanacak.**

5. **Test ortamı** (rapor-03 ortam notu): Bulutta Playwright 1.63.0'a sabitlenmeli (hazır Chromium 1243); `fk/requirements-test.txt` (pytest, httpx, pillow, reportlab) yok; `test/ornek/` ve `fk/tests/veri_*.xlsx` depoda yok, bu yüzden e2e 250 yerine 204 test çalışıyor (1 düşüyor) ve pytest 2 düşüyor. Sahte örnek verilerle yeniden üretme görevi Yazılımcı'ya açılacak.

6. **Güvenlik düzeltme sırası** (rapor-02): 05 (G-A) → 06 (G-C) → test örnek verileri → Görev 01 birleştikten sonra G-B (pdf.js `isEvalSupported:false`, `renderer/index.html`) ve G-J (CSP) → G-D, G-F, G-E, G-I, G-G. **Kullanıcı kararı (23.10.2026):** O7 → ofis başına en fazla **10 kullanıcı** (G-E lisans sıkılaştırma görevine eklenecek). **Bekleyen:** G-H (kod imzalama sertifikası; OV yaklaşık 215–300 USD/yıl, Azure Artifact Signing Türkiye'den kullanılamıyor). `supabase-kurulum.sql` depoda yok; temel tabloların RLS'i denetlenemedi, kullanıcıdan alınmalı.
7. ~~**Test örnek dosyaları**~~ → **Kapandı** (Görev 11, #31).

8. **Muhasebe Denetimi siteye geçiş** (plan: `belgeler/denetim-gecis-plani.md`). **Kullanıcı kararları (24.10.2026):** eski denetim kayıtları siteye **taşınmaz** (seçenek A); geçiş sürecinde **program ve site birlikte durur** (en az bir sürüm). Site yayına girince masaüstündeki karta "Sitede aç" bağlantısı eklenecek (Menü Düzenleme); programdan kaldırma ayrı kararla sonra.

9. **İleride hatırlatılacaklar (kullanıcı: "çok ileride sor", 24.10.2026):** (a) Red/iptal faturalarını Luca'dan getirme — Luca'da böyle bir ekran şimdilik yok; (b) Google İşletme Profili ek doğrulaması (video vb. istiyor) — sonra yapılacak. (c) Muhasebe Denetimi yapay zekâ önerisi (Görev 43 Faz 4) kullanıcı isteğiyle şimdilik kapatıldı (Görev 49); ileride yeniden açmayı hatırlat. Bunları kısa vadede sorma.
10. **Hesap planına VKN/TCKN (Görev 42):** Program yeni hesapları Luca'ya Excel ile değil `addHesapPlaniAction.do` ile tek tek açıyor; Luca'dan hesap planı Excel'i yalnız okunuyor. Kullanıcı şablonu daha önce verdiğini söylüyor; depoda bulunamadı. VKN alanının adı için Luca'da VKN girilerek hesap eklerken alınmış İstek Kaydı ya da boş Excel şablonu gerekli.
11. **Supabase planı:** Kullanıcı şimdilik ücretsiz planda kalıyor (Pro'ya geçip geçmeme kararı sonra). Ücretsiz plan 1 hafta kullanılmazsa duruyor; Pzt/Çar/Cum 08:47 (TR) hatırlatma kuruldu (trig_015aL4cCp5pnhfu3b5L169kM).

## Önerilen eklentiler
- **claude-security** (Anthropic): Görev 02 için.
- **Security Guidance** (Anthropic): Kod yazan tüm işçilerde açık olmalı.
