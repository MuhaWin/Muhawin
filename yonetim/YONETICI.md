# MuhaWin – Yönetici Belgesi

Bu belgenin sahibi yönetici oturumudur. Diğer oturumlar belgeyi **okur, değiştirmez**; önerilerini raporlarına yazar.
Belge 23.10.2026'da Cowork projesinden ("Luca Fatura Muavin Kontrolü") depoya taşındı. Cowork projesi artık arşivdir; güncel kaynak bu klasördür.

## Roller ve oturumlar (tümü Code bölümünde, `MuhaWin/Muhawin` deposuna bağlı)
- **Yönetici:** İşleri parçalara böler ve her parça için görev kartı yazar (`yonetim/gorevler/gorev-NN-<konu>.md`). PR'ları inceler, kabul ya da ret kararı verir, kabul edilenleri birleştirir. `yonetim/` klasörünü günceller.
- **Ana Depo 2 (MuhaWin/Muhawin)** (`session_01HKMyx49yrftMV598oVTfLH`):
  - Depo kurulumunu yapar, `main` dalının bakımını üstlenir.
  - Derleme ve sürüm çıkarma yalnız kullanıcı isterse yapılır (bkz. `belgeler/ana-depo-ozet.md` §4).
  - Eski 75 commit'lik geçmiş, Cowork'teki ilk "Ana depo" oturumunda arşiv olarak duruyor; GitHub'a taşınmadı.
- **İşçi:** Tek bir görev kartını uygular. Kendi dalında çalışır, PR açar ve raporunu `yonetim/raporlar/rapor-NN.md` dosyasına yazar (aynı PR içinde).

## Klasör düzeni
- `yonetim/YONETICI.md`: bu belge.
- `yonetim/gorevler/`: görev kartları.
- `yonetim/raporlar/`: işçi ve Ana Depo raporları.
- `yonetim/belgeler/`: durum, mimari özeti, tasarımlar, araştırmalar.

## İşleyiş
1. Yönetici görev kartını yazar ve `main` dalına commit eder. Yalnız `yonetim/` klasöründe doğrudan commit yapma hakkı vardır.
2. Kullanıcı işçi oturumunu depo seçili olarak açar ve şunu yazar: `Görev NN'in işçisisin. yonetim/YONETICI.md ve yonetim/gorevler/gorev-NN-*.md dosyalarını oku, uygula.`
3. İşçi `gorev-NN-<konu>` dalında çalışır, testleri çalıştırır, push eder ve PR açar.
4. Yönetici PR'ı inceler (diff, testler, kapsam) ve PR'a yorum yazar: `KABUL` ya da `RET + gerekçe`. Kabul edilen PR **squash merge** ile birleştirilir.
5. Paralel çalışma yalnız farklı dosyalara dokunan görevlerde yapılır. Aynı dosyaya dokunan görevler sırayla yürür. Bu dosyalar: `renderer/index.html`, `luca.js`, `main.js`, `fk/fatura_kontrol/web/toplu_api.py`. Sıradaki görev, önceki merge'ten sonra `main` üzerine rebase edilir.
6. Kullanıcıya derlenmiş sürüm gerektiğinde Ana Depo 2 `main` dalını derler ve `v<sürüm>` etiketi koyar. Sürüm dosyaları `McLk007/muhawin-surumler` deposuna yüklenir.

## İşçi oturum kuralları
Her işçi oturumu başladığında bu bölümü okur ve tüm kurallara uyar.

1. **Hitap ve dolgu kelimesi yok.** Yanıt doğrudan işle başlar. Selamlama, "Tabii", "Hemen yapıyorum", "Elbette", teşekkür, özet tekrarı ve kapanış cümlesi yazılmaz. Amaç token tasarrufudur.
2. **En fazla 20 kullanıcı mesajı.** Her yanıtın son satırı `[mesaj N/20]` olur.
   - 17. mesajda devir notuyla birlikte raporu yazmaya başla.
   - 19. mesajda commit et, push et ve PR aç.
   - 20. mesajda yeni iş alma; kullanıcıya "Oturum sınırı doldu, yeni işçi oturumu açın" de.
   - Devam eden bir işi yarım bırakma; sınır yaklaşınca işi küçült.
3. **GitHub kuralları:**
   - Yalnız kendi `gorev-NN-*` dalına push et.
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
| 01 | Menü düzeni (**B: üstte modül sekmeleri**, kullanıcı kararı) | `gorevler/gorev-01-menu-duzeni.md` | Kod yazılmadı. Ara rapor: `raporlar/rapor-01.md` |
| 02 | Güvenlik denetimi (yalnız okuma) | `gorevler/gorev-02-guvenlik-denetimi.md` | Açık |
| – | Ortak veri deposu (Supabase) | Tasarım: `belgeler/bulut-veri-tasarimi.md` | Taslak; kullanıcı kararı bekleniyor (silme yetkisi, Supabase planı) |

## Açık konular
1. **Luca sayfa yönetimi** (rapor-01 madde 4, Görev 01 kapsamı dışında kaldı): "Luca'da Çalış" ayrı pencerede açılsın; aynı anda ek bir iş başlarsa yeni Luca sayfası açılsın. Bu iş `luca.js` ve Playwright'a dokunuyor. Görev 01 birleştirildikten sonra ayrı görev olarak açılacak.
2. **`test/ornek/`** (`logo_musteri`, `mizan_inka`, `mizan_savor`, `mikro_*`, `okc_fis*`): Gerçek müşteri verisi olabilir. Kullanıcı doğrulamalı. Gerçekse sahte verilerle değiştirme görevi açılacak; bu dosyalar depoya girmez.
3. **Hesap geçişi:** Kullanıcı Team hesabından kişisel Max 20x hesabına geçmeyi düşünüyor. Depo hesaptan bağımsız; geçişte yalnız GitHub bağlantısı yeniden kurulur. Max planında Claude Code "Projects" özelliği de var; bu düzen için uygun.

## Önerilen eklentiler
- **claude-security** (Anthropic): Görev 02 için.
- **Security Guidance** (Anthropic): Kod yazan tüm işçilerde açık olmalı.
