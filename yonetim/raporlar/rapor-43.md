# Rapor 43 – Muhasebe Denetimi'nin genişletilmesi

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 24.10.2026
Dal: `claude/beautiful-bohr-c7x9ij`. Taban: `main` cddf1b4. Derleme yapılmadı. İş, sonraki sürüme girecek; 2.9.14 bu işi beklemiyor.

İş üç faza bölündü ve her faz ayrı PR ile gelecek. Bu rapor faz faz dolacak.

Genel kural: Program (masaüstü) ve site (`web/denetim`) aynı sayfayı ve aynı Python kodunu kullanır. Faturalar ve muavin kullanıcının bilgisayarında ya da tarayıcısında işlenir; sunucuya belge gitmez.

---

## FAZ 1 – Programdan bağımsız hale getirme ve temel kontroller

### 1. Muhasebe programı: Mikro · Elektra · Luca
"2. Belgeler" bölümündeki **Muhasebe programı** seçimi artık açık ve üç seçenek var. Sıra `muavin_programlari.DENETIM_SIRA` ile belirlenir.

| Program | Muavin | Faturalar |
|---|---|---|
| **Mikro** | Mevcut okuyucu, değişmedi | XML / ZIP yükleme ya da "Faturaları Luca'dan Al" |
| **Elektra** | Yeni okuyucu `elektra_muavin.py`; kullanıcının gönderdiği biçime göre yazıldı (aşağıda "Elektra okuyucusu") | XML / ZIP yükleme ya da "Faturaları Luca'dan Al" |
| **Luca** | Dosya yükleme (mevcut Luca muavin okuyucusu). Masaüstünde ayrıca **"Muavini Luca'dan Al (seçili ay)"** düğmesi ve "Luca'dan alınmış muavini kullan" kutusu var. | Masaüstünde "Faturaları Luca'dan Al", her yerde XML / ZIP yükleme |

- **Sitede (tarayıcıda) Luca'dan getirme yoktur.** Luca kutuları gizlidir; yalnız dosya yüklenir. Bu, uçtan uca site testinde sınandı.
- **"Muavini Luca'dan Al" nasıl çalışır:** Mevcut toplu Luca otomasyonunun yalnız "muavin" adımını çalıştırır (`/api/toplu/baslat` → `yalniz_fatura: true, adim: "muavin"`).
  - Sonuç `toplu/_tek/<ay>` altına yazılır; toplu kontrol geçmişine girmez.
  - Faturaları Luca'dan alma ile aynı yol ve aynı iş kilidi kullanılır.
  - Muavin, firmanın dönem klasörüne `muavin.xlsx` olarak iner.
- **"Luca'dan alınmış muavin" sayılma koşulu:** Dönem klasöründe `muavin.xlsx` olmalı ve adım kaydında `muavin = tamam` yazmalı. Kullanıcının elle yüklediği muavin bu sayılmaz (testte sınandı).
- **Muavin hiç seçilmemiş ve Luca muavini kullanılıyorsa:** İstek `muavin_kaynak=luca` ile gider. Bu, yalnız program Luca seçiliyken kabul edilir.
- **İşletme defteri firmaları:** Luca'dan işletme defteri listesi (json) iner, xlsx muavin inmez. Bu firmalarda Luca muavini "yok" görünür.
- **Metinler genelleştirildi.** "Mikro'dan alınan XML" yerine "Muhasebe programından alınan XML", "firmanın Mikro muavini" yerine "firmanın muavini" yazıyor. Başlıktaki "Mikro muavini" kalktı. Programdaki kartın açıklaması "Muhasebe programından (Mikro, Luca)" oldu. Lisans kimliği `id:'mikro'` değişmedi.
- **Okuyucusu olmayan program:** Listeye ileride okuyucusu henüz yazılmamış bir program eklenirse (`hazir: False`) ekranda uyarı çıkar, muavin alanı ve "Denetimi Başlat" kapanır, sunucu 400 döner. Bugün böyle bir program yok.
- **Tek firma kontrol ekranı değişmedi.** Program listesi aynı kaldı; Elektra orada görünmez (`yalniz_denetim`).

### 1a. Elektra okuyucusu (`fk/fatura_kontrol/elektra_muavin.py`)
Biçim, yöneticinin aktardığı gerçek örneğin yapısından alındı. Gerçek dosya bana gelmedi; testler sahte dosyayla (`fk/tests/elektra_ornek.py`).

- **Başlık:** 15 sütun; "Dok Tipi" iki kez geçer, ilki kullanılır. Başlıklar Türkçe harf ve büyük/küçük harf farkı gözetmeden eşlenir.
- **Hesap grup satırı** (yalnız "Grup" dolu, `" -> 100.01.01.001 Kasa Hesabı / TL"`, başta başka sözcük olabilir): atlanır. Tutarları devir/özet olduğu için hareket sayılmaz.
- **Hareket satırı:**
  - Hesap kodu satırdan alınır; harfli seviye (120.01.01.A010) olabilir.
  - Fiş numarası metin olarak kalır, baştaki sıfırlar korunur.
  - Fiş tarihi Excel tarihidir.
  - Dok Tipi fiş tipi olarak alınır.
  - Açıklama = Fiş Notu · Detay Notları.
  - e-fatura numarası (16 karakter) bu açıklamadan çıkarılır ve eşleştirmede kullanılır.
  - Cari hesaplarda (120/320 …) ünvan olarak hesap adı alınır.
  - Döviz sütunları kullanılmaz; boş ayraç satırları ve borcu da alacağı da sıfır olan satırlar atlanır.
- **Hız:**
  - Sayfa XML'i doğrudan akışla okunur; okunamazsa openpyxl'e düşer.
  - 182 bin satırlık sahte dosya: CPython'da 10 sn (openpyxl ile 31 sn). Tarayıcıda (Pyodide) 27 sn.
  - Denetim aynı muavini üç kez okuyor (doğrulama, kontrol raporu, denetim). Dosya içeriğinin özetine göre önbellek tutulduğu için ikinci ve üçüncü okuma ~1 sn. Önbellekte yalnız son dosya durur; satırların kopyası verilir.
- **Testler:**
  - Aynı kayıtlar Mikro ve Elektra muavinleriyle denetlenince sonuç birebir aynı (masaüstü API'si ve tarayıcıdaki köprü).
  - Hızlı okuyucu ile openpyxl aynı sonucu veriyor.
  - Paylaşılan metinli (sharedStrings) dosya, sayı olarak yazılmış fiş no ve bozuk başlık durumları da sınandı.

### 2. Red / iptal faturalar
- **Dosya yapısı aynı kaldı.** Kullanıcının verdiği Mikro e-Fatura / e-Arşiv gelen ve giden kutusu listesi düzeni (`red_iptal.DUZENLER["mikro"]`) bütün programlarda kullanılıyor.
- **Etiket:** "Red / iptal fatura listeleri (programdan alınan Excel …)".
- **Luca seçiliyken:** Luca'dan red / iptal listesi **otomatik alınamıyor**. Ekranda "Luca'dan henüz otomatik alınamıyor; Excel olarak yükleyin" notu çıkıyor. Neden alınamadığı: [Açık konular](#açık-konular--yöneticiye-sorular) 1.

### 3. Dönem
- Başlangıç ve bitiş tarihleri yerinde duruyor.
- Üstlerine **Dönem** tablosu eklendi: yıl seçimi ve 12 ay düğmesi (Oca … Ara).
  - Bir aya basınca tarihler o ayın 1'i ile son günü olur. Şubat ve artık yıl doğru hesaplanır.
  - Seçili ay vurgulanır.
- Ara tarih (ör. 01.09–10.09) yine elle girilir; o zaman ay vurgusu kalkar.
- Luca kutuları başlangıç tarihi değişince yenilenir.

### 4. KDV kontrolü
Özet ekranı aynı kaldı. KDV kontrolü artık şunları denetliyor:

- **Tutar:** faturadaki KDV ↔ muavindeki 191 / 391. Bu, önceki kurallarla aynı: binek %70, döviz, tevkifat, ihraç kayıtlı …
- **KDV oranı ↔ hesap:** Hesap adında oran varsa (`%20 İndirilecek KDV`) önceden de denetleniyordu. Yeni: adında oran yoksa oran **hesap kodundan** okunur (191.01.20 → %20). Faturanın %20 KDV'si %10 hesabına yazılmışsa sonuç "Yanlış KDV oranı hesabı" olur.
  - **Yanlış alarm olmasın diye koşullar** (`denetim.kod_oranlari`). Oran koddan yalnız şu durumda okunur:
    - adında oran olmayan bütün 191 / 391 alt hesapları en az üç bölümlü;
    - son bölüm 1–2 haneli ve 1, 8, 10, 18 ya da 20;
    - en az biri %8 ya da üstü.
  - Koşullar tutmazsa koddan oran okunmaz ve oran kontrolü eskisi gibi yalnız hesap adına bakar. Örnek: `191.01.01` tek başına sıra numarası olabilir.
  - Oran koddan okunduysa raporun uyarılarında "KDV oranı hesap kodundan okundu: 191.01.20 = %20 …" yazar.
- **KDV doğru fişte mi** (`denetim.kdv_fis_kontrol`, yeni durum **"KDV faturanın fişinde değil"**, sorunlu):
  - KDV satırı, aynı faturanın cari kaydının fişinde olmalı. Cari kaydı yoksa gider / gelir kaydının fişine bakılır.
  - KDV başka fişteyse açıklamada iki fiş de yazar.
- **Kapsam:** Bu iki ek yalnız Denetim'de çalışır. Fatura Kontrol (tek firma / toplu) ve standart Excel raporu değişmedi. `MuavinSatiri.kod_orani` varsayılanı boş olduğu için başka yerde etkisi yok.

### 5. Fiş görünümü bütün listelerde
Fiş no / tarih düğmesine basınca Görev 19 / 34'teki fiş penceresi açılır: muavinden kurulan fiş, ana hesaplar, yazdır / PDF.
- **Önceden de vardı:** KDV, matrah, cari, ÖİV listeleri.
- **Yeni:** Faturası olmayan kayıtlar, red / iptal listesi, Muhtasar ayrıntıları ve türü bulunamayan 360 kayıtları. Muhtasar satırlarına `fis_tarihi` eklendi; önceki tarih alanı belge tarihi olabiliyordu.

### Değişen dosyalar (Faz 1)
| Dosya | Değişiklik |
|---|---|
| `fk/fatura_kontrol/muavin_programlari.py` | Luca'ya `denetim`; yeni `elektra` kaydı (`yalniz_denetim`); `DENETIM_SIRA`, `hazir_mi`; `liste()` yanıtında `hazir` |
| `fk/fatura_kontrol/elektra_muavin.py` | Yeni: Elektra muavin okuyucusu (akışlı xlsx, openpyxl yedeği, önbellek) |
| `fk/fatura_kontrol/muavin_okuyucu.py` | `MuavinSatiri.kod_orani` (varsayılan boş); `kdv_orani` önce addan, sonra bundan |
| `fk/fatura_kontrol/denetim.py` | `kod_oranlari`, `kdv_fis_kontrol`; muhtasarda `fis_tarihi` |
| `fk/fatura_kontrol/eslestirme.py` | `KDV_FIS_FARKI` sabiti (`TUM_DURUMLAR`'a eklenmedi, standart rapor aynı) |
| `fk/fatura_kontrol/web/app.py` | `/api/denetim`: muavin isteğe bağlı, `muavin_kaynak=luca`, hazır olmayan program → 400. `_luca_muavini`. `/api/kontrol/luca-faturalari` yanıtına `muavin` |
| `fk/fatura_kontrol/web/toplu_api.py` | Tek firma (`yalniz_fatura`) yolunda `adim: "muavin"` kabul edilir |
| `fk/fatura_kontrol/web/static/denetim.html` | Program seçimi, uyarı, Luca muavin kutusu, red notu, Dönem tablosu, genel metinler, fiş düğmeleri, KDV açıklaması |
| `renderer/app.js` | Kart açıklaması ve yorum (yalnız metin) |
| `fk/fatura_kontrol/web/static/beyanname.html` | Yorum |

### Testler (Faz 1)
- **Yeni: `fk/tests/test_denetim_faz1.py`** (12 test):
  - koddan oran ve oran hatası;
  - belirsiz kodlarda oran okunmaz (4 durum);
  - addaki oran öncelikli;
  - KDV başka fişte (cari ya da gider fişine göre);
  - program listesi; Elektra ile Mikro aynı sonuç; Elektra okuyucusu (grup satırı, fiş no, harfli kod, sharedStrings, bozuk başlık);
  - Luca muavini: sahte Luca süreci, toplu geçmişine girmez, elle yüklenen muavin sayılmaz, Luca dışı programda 400;
  - tarayıcıda: program seçimi, okuyucusu olmayan programda uyarı, dönem tablosu, muhtasar fiş düğmesi.
- **Güncellenen:**
  - `test_rapor_kayit.py`: Denetim listesinde artık Luca da var; "desteklenmeyen program" örneği `luca_isletme_excel`.
  - `test_program.py`: Tek firmada "muavin" adımı artık kabul ediliyor.
  - `sahte_toplu.py`: "muavin" adımı eklendi.
  - `web/tarayici-deneme/ornek_uret.py`: sahte Elektra muavini de üretiliyor.
  - `web/denetim/kopru.test.mjs`: Program listesi; muavinsiz istek artık 422 değil 400 ve açıklamalı; Elektra muavini Pyodide'de okunur ve Mikro ile aynı sonucu verir (6/6).
  - `web/denetim/site_e2e.py`: Sitede Luca seçilince yalnız dosya yükleme; Elektra seçilebilir.
- **Sonuçlar:**
  - **pytest:** 172 geçti. 16 hata, `main` ile aynı ortam hataları: Luca otomasyonu için gerçek Chrome, `test_program_ekrani`.
  - **Site:** köprü 6/6, sürüm notu 6/6, uçtan uca site testi TAMAM.
  - **Luca fis-goster:** 20/20.
- **Elektron e2e bu ortamda çalışmıyor; yöneticinin çalıştırması gerekiyor.** Denetim adımında program varsayılanı yine Mikro (listede ilk sırada), bu yüzden mevcut adımlar değişmeden geçmeli.

### Açık konular / yöneticiye sorular
1. **Red / iptal Luca'dan otomatik getirilemiyor.**
   - Luca'da red / iptal listesinin hangi ekranda olduğu ve hangi biçimde indirildiği bilinmiyor.
   - Luca otomasyonunda adında "iptal" geçen düğmelere güvenlik gereği hiç basılmıyor (`YASAK`).
   - Bunun için kullanıcıdan Luca'daki ekranın adı ya da ekran görüntüsü, varsa örnek bir liste gerekiyor.
   - O zamana kadar Excel yükleniyor ve ekranda not var.
2. **Elektra gerçek dosyayla denenmedi.** Okuyucu aktarılan yapıya göre yazıldı ve sahte dosyayla sınandı. Kullanıcının ilk denemesinde tutarların ve fiş eşleşmesinin doğru çıktığına bakılmalı.
3. **"KDV doğru fişte mi" kuralının yorumu:** KDV satırı faturanın cari kaydının fişinde olmalı (cari yoksa gider / gelir fişinde). Kullanıcı başka bir şey kastettiyse (ör. fiş türü) kural kolayca genişletilir.
4. **Gerçek veriyle doğrulanmadı.**
   - Luca'dan muavin alma: toplu otomasyonun muavin adımı zaten kullanılıyor.
   - Koddan oran okuma: kullanıcının hesap planı örneği yok; koşullar bilerek sıkı tutuldu.

---

## FAZ 2 – Detay denetim (gider kontrolü / gelir kontrolü) + Muhtasar ve Prim Hizmet Beyannamesi (1003A) PDF karşılaştırması
_Faz 1 kabul edilince. Muhtasar: yalnız matrah ve vergi bildirimi, terkin/mahsup, tahakkuka esas icmal, damga ve tevkifata tabi ödemeler okunur; çalışan bilgileri okunmaz, kişisel alanlar kaydedilmez._

## FAZ 3 – Yönetici raporu (görsel)
_Faz 2'den sonra._
