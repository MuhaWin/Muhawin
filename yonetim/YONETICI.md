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
- **İşçi:** Tek bir görev kartını uygular. Kullanıcı kararı (23.10.2026): Yönetici altında yalnız üç oturum vardır: **Yazılımcı**, **Güncelleme**, **Menü Düzenleme**. Yeni görevler bu oturumlara verilir; yönetici işi oturuma doğrudan mesajla iletir. Kendi dalında çalışır, PR açar ve raporunu `yonetim/raporlar/rapor-NN.md` dosyasına yazar (aynı PR içinde).

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
| 01 | Menü düzeni (**B: üstte modül sekmeleri**, kullanıcı kararı) | `gorevler/gorev-01-menu-duzeni.md` | İşçi oturumu: **Menü Düzenleme**. Kod yazılmadı. Ara rapor: `raporlar/rapor-01.md` |
| 02 | Güvenlik denetimi (yalnız okuma) | `gorevler/gorev-02-guvenlik-denetimi.md` | Açık. Uygulayan: **Yazılımcı** (Görev 03'ten sonra) |
| 03 | Açılışta güncelleme sorusu ("Şimdi kur / Sonra") | `gorevler/gorev-03-guncelleme-sorusu.md` | Açık. Uygulayan: **Yazılımcı**. Görev 01 ile paralel yürüyebilir (`renderer/index.html`'e dokunmaz) |
| G | Derleme ve yayın (kalıcı) | `gorevler/guncelleyici.md` | G-01: 2.9.13 deneme derlemesi, açık |
| – | Ortak veri deposu (Supabase) | Tasarım: `belgeler/bulut-veri-tasarimi.md` | Taslak; kullanıcı kararı bekleniyor (silme yetkisi, Supabase planı) |

## Sürüm planı
- **2.9.13 (G-01, deneme):** Kullanıcı programın son halini denemek istedi (23.10.2026). `main`'in bugünkü hali derlenir ve yalnız kullanıcıya gönderilir; GitHub'a yayınlanmaz.
- **İlk yayın (2.9.14 ya da sonrası):** Görev 01 ve Görev 03 birleştirildikten **ve** sürüm deposu taşındıktan (açık konu 4) sonra derlenir ve `muhawin/muhawin-surumler` deposuna yayınlanır. Kurulu programlar bu sürümü kendiliğinden bulur. Görev 03'ün "Şimdi kur / Sonra" sorusu, bu sürüm kurulduktan **sonraki** yayında görülür (soru, kurulu sürümün kodunda olmalı).

## Açık konular
1. **Luca sayfa yönetimi** (rapor-01 madde 4, Görev 01 kapsamı dışında kaldı): "Luca'da Çalış" ayrı pencerede açılsın; aynı anda ek bir iş başlarsa yeni Luca sayfası açılsın. Bu iş `luca.js` ve Playwright'a dokunuyor. Görev 01 birleştirildikten sonra ayrı görev olarak açılacak.
2. **`test/ornek/`** (`logo_musteri`, `mizan_inka`, `mizan_savor`, `mikro_*`, `okc_fis*`): Gerçek müşteri verisi olabilir. Kullanıcı doğrulamalı. Gerçekse sahte verilerle değiştirme görevi açılacak; bu dosyalar depoya girmez.
3. **Hesap geçişi:** Kullanıcı Team hesabından kişisel Max 20x hesabına geçmeyi düşünüyor. Depo hesaptan bağımsız; geçişte yalnız GitHub bağlantısı yeniden kurulur. Max planında Claude Code "Projects" özelliği de var; bu düzen için uygun.
4. **Sürüm deposu taşınıyor** (23.10.2026): `McLk007/muhawin-surumler` → `muhawin/muhawin-surumler`. `package.json` → `build.publish` güncellendi. Kurulu sürümler adresi derlemede `app-update.yml`'ye yazılmış haliyle (eski depo) arar. **Karar:** Eski depo GitHub "Transfer ownership" ile taşınacak; GitHub yönlendirmesi sayesinde köprü sürüm gerekmez. Yeni açılan boş depo önce silinecek ya da yeniden adlandırılacak (ad çakışması). Taşımadan sonra `McLk007` altında aynı adla depo açılmamalı, depo herkese açık kalmalı. 2.9.4 öncesinde otomatik güncelleme yok, elle kurulur. **Kullanıcı yapacak; sonra doğrulanacak.**

## Önerilen eklentiler
- **claude-security** (Anthropic): Görev 02 için.
- **Security Guidance** (Anthropic): Kod yazan tüm işçilerde açık olmalı.
