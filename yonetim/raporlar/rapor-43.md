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

### 6. "Fatura" düğmesi (kullanıcı isteği, Faz 1'e ek)
Bütün denetim listelerinde fiş düğmesinin yanında **📄 Fatura** düğmesi var: KDV, matrah, cari, özet, ÖİV, faturasız, red / iptal. Detay denetim (Faz 2) de bunu kullanacak.
- **Tıklayınca:** Faturanın GİB şablonlu görünümü açılır (`/api/fatura/goruntu`, `goruntu.py`).
  - Masaüstünde mevcut PDF penceresi kullanılır (`faturaPdf`).
  - Sitede görünüm tarayıcıda, kum havuzlu çerçevede açılır; fatura sunucuya gitmez.
- **Fatura dosyası yoksa** düğme pasif: "📄 Fatura yok". Bu, faturası olmayan kayıtlarda ve e-fatura dosyasında bulunmayan red / iptal satırlarında olur.
- **Test:** Tarayıcı testinde açılan pencerede fatura numarası çıkıyor. Uçtan uca site testinde görünüm kum havuzlu çerçevede açılıyor.

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

## FAZ 2 – Detay denetim (gider / gelir kontrolü) ve Muhtasar 1003A karşılaştırması

**Hiçbir kayıt yapılmaz.** Bu fazdaki her şey yalnız kontrol: Luca'ya, Mikro'ya, Elektra'ya ya da muavine yazılan bir şey yok. Masaüstünde ve sitede (Pyodide) aynı kod çalışır, belgeler sunucuya gitmez.

### 6. Detay denetim: Gider kontrolü ve Gelir kontrolü (`fk/fatura_kontrol/detay.py`)
Soldaki menüde yeni "Detay denetim" grubu var: **Gider kontrolü**, **Gelir kontrolü**, **Kontrol kuralları**, **Denetim raporu**.

Denetim çalışırken her dönem faturası için şu çıkarılır ve `denetim.json › detay` bölümüne yazılır:
- **Kaydı:** Gider hesapları (alış: 15x, 25x, 26x, 6xx gider, 7xx; Denetim'in matrah kontrolündeki kural) ya da gelir hesapları (satış: 60x, 64x, 67x). Tutarlar hesap bazında toplanır.
- **Fişi:** Toplu fişlerde yalnız o faturanın satırları alınır, başka faturalar karışmaz.
- **Carisi:** Alışta alacaklı, satışta borçlu cari / ödeme hesabı.

### 7. Kontrol kuralları
Kural kayıt yapmaz. Kurala uyan fatura otomatik "uygun" sayılır ve listeye düşmez.
- **Biçim:** "Alış · VKN 1234567890 (ya da ünvan içerir) → hesap 770 / 770.01.01.001 · açıklama".
- **Uymazsa:** Kural tutar ama kayıt başka hesapta ise fatura listede kalır: "Kural 3: 770 bekliyor; kayıt 760.01".
- **Nerede saklanır:** Firma klasöründe `detay-kurallari.json`; sonraki aylarda da geçerli.
- **Nasıl eklenir:** Kurallar ekranından ya da kontrol ekranında "Bu cari için kural ekle" ile. Hesap, faturanın kaydından hazır gelir.

### 8. Geçmişe göre otomatik değerlendirme (deterministik)
Yıllık muavinde, faturanın carisine ait önceki ayların fişlerine bakılır. Toplu fişler (birden çok cari) atlanır.
- **Cari kimliği:**
  - alt hesap firmaya özelse (320.01.0032) hesap kodu;
  - değilse (Mikro 320.01 + cari ismi) muavindeki ünvanın kökleri.
- **"Geçmişle uyumlu" sayılma koşulu:**
  - en az iki önceki ayda kayıt var;
  - bu ayların hepsinde aynı hesap(lar) kullanılmış;
  - bu ay da aynı hesap(lar) kullanılmış;
  - tutar önceki ayların aralığında: en düşüğün yarısı ile en yükseğin 1,5 katı arası.
- Örnek: her ay gelen SMMM, elektrik, su, kira faturaları.
- **Uyumsuzsa gerekçe yazılır:** "yalnız 1 ay kayıt var", "önceki aylarda farklı hesaplara", "önceki aylarda 770…; bu ay 760…", "tutar önceki ayların aralığının dışında".
- **Yapay zeka seçeneği (karar kullanıcının; uygulanmadı):**
  - Fatura / muavin bir dış yapay zeka servisine gönderilirse "belgeler bilgisayarda kalır" kuralı bozulur. Bu yüzden yapılmadı.
  - Seçenek A: dışarıya yalnız anonim özet gider (ünvan yerine sektör, tutar aralığı, hesap adı). Kullanıcı onayı ve KVKK değerlendirmesi gerekir.
  - Seçenek B: kullanıcının bilgisayarında çalışan yerel bir model. Kurulumu ve boyutu büyük.
  - Bugünkü deterministik kurallar ve kullanıcının kararları zamanla öğreniyor: kurallar firmada birikiyor.

### 9. Kontrol ekranı (büyük ekran)
"Kontrole başla" ya da bir satırdaki "İncele" ile açılır.
- **Sol taraf:**
  - fatura bilgisi (belge no, tarih, karşı taraf, VKN, matrah, KDV, toplam);
  - kayıt (hesaplar ve tutarları; kayıt ≠ matrah ise kırmızı uyarı), cari, geçmiş özeti;
  - **fişin kendisi:** muavinden kurulur, faturanın hesap satırları vurgulu;
  - not alanı.
- **Sağ taraf:** Faturanın görünümü; listelerdeki "Fatura" düğmesiyle aynı GİB şablonu. Betiksiz (`sandbox=""`) çerçevede açılır. Masaüstünde yan süreçten, sitede tarayıcıdaki köprüden gelir; fatura sunucuya gitmez.
- **Düğmeler:** Yeşil **✓ Uygun (U)**, kırmızı **✗ Uygun değil (D)**, **← Önceki**, **Sonraki →**.
- **Karar verilince:** Fatura sıradan çıkar ve sonraki açılır, liste azalır. Liste bitince ekran kapanır.
- **Kısayollar:** U, D, ←, →, Esc. Not alanına yazarken kısayollar çalışmaz.
- **Kararlar:** Firma klasöründe `detay-kararlar.json`; fatura anahtarı (ETTN) ile tutulur. Denetim yeniden yapılsa da kalır (testte sınandı).
- **Öncelik:** karar > kural > geçmiş > bekliyor.

### 10. Denetim raporu (`fk/fatura_kontrol/detay_rapor.py`, `/api/denetim/detay/rapor`)
Yazdırılabilir HTML; masaüstünde ve sitede ayrı pencerede açılır. Toplu kontrol raporu düzeninde:
- **KDV kontrolü ve matrah kontrolü:** durum sayıları ve sorunlu satırlar (belge, tarih, karşı taraf, fatura, muavin, fark, fiş, açıklama).
- **Gider ve gelir kontrolü:** durum kutuları; "uygun değil" ve bekleyenler gerekçeleriyle; uygun bulunanlar katlanır listede.
- **Muhtasar:** beyanname yüklendiyse karşılaştırması.
- Hazırlayan / Onaylayan imza alanları.

### Muhtasar ve Prim Hizmet Beyannamesi (1003A PDF) ↔ muavin (`fk/fatura_kontrol/muhtasar_beyan.py`)
"Muhtasar" ekranında **Beyanname (PDF) → Karşılaştır**.
- **PDF okuma:** pypdf ile düzen korunarak okunur. pypdf saf Python; masaüstünde `fk/requirements.txt`, sitede `web/denetim/wheels.txt` ile geliyor.
- **Okunanlar:**
  - başlık: 1003A, vergi dairesi, yıl / ay (Türkçe ay adı), onay zamanı;
  - vergi sorumlusu: VKN ve unvan (iki satır birleşir);
  - matrah ve vergi bildirimi: tür kodu, gayrisafi, kesinti, toplam;
  - terkin, terkin sonrası kalan, tevkifata ilişkin damga;
  - tahakkuka esas icmal;
  - tevkifata tabi ödemeler bildirimi: yalnız tür kodu başına kişi adedi, gayrisafi ve kesinti toplamları.
- **Okunmayanlar (kullanıcı kararı):** "VERGİ BİLDİRİMİ" (çalışan) ve "Sigortalı Çalışan Bilgileri" bölümleri. 011 ücret yalnız tür kodu satırıyla karşılaştırılıyor.
- **Kişisel veri:** TC, ad soyad, adres hiçbir yere yazılmaz; okuma sırasında da tutulmaz. PDF kaydedilmez. Dönem klasörüne yalnız tutar ve adetlerden oluşan özet (`muhtasar_beyan.json`) yazılır. Testlerde kayıtta, yanıtta ve rapordaki çıktıda kişi verisi olmadığı sınandı.
- **Karşılaştırma:** Fark 1 TL'yi aşarsa "Fark".
  - ödenecek toplam (kalan stopaj + damga) ↔ 360 tahakkukları;
  - 011 kesinti ↔ 360 ücret stopajı; 011 gayrisafi ↔ ücret giderleri (bilgi: SGK işveren payı olabilir);
  - 022 kesinti ↔ 360 serbest meslek; 022 gayrisafi ↔ e-SMM alış faturaları; %20 oranı;
  - 041 kesinti ↔ 360 kira; 041 gayrisafi ↔ kira giderleri; %20 oranı;
  - damga ↔ 360 damga;
  - diğer kodlar bilgi olarak.
  - Beyannamenin dönemi ya da VKN'si denetimle tutmazsa uyarı çıkar.
- **Güncel kalır:** Karşılaştırma her açılışta güncel denetim ve muavinle yeniden yapılır.
- **Gerçek PDF'te yöneticinin denemesi:**
  - Yönetici gerçek PDF'i yalnız kendi oturumunda okuttu. Form, dönem, VKN, unvan, kod tutarları ve toplamlar doğru çıktı.
  - Beş hata vardı; düzeltildi (ayrı commit):
    1. Vergi dairesi iki satıra bölünmüş ve aynı satırlarda dönem sütunları vardı. Artık büyük harfli "… VERGİ DAİRESİ" sütunu alınıyor, komşu satırdaki "MÜDÜRLÜĞÜ" ekleniyor.
    2. "Onay Zamanı :" (iki noktalı) okunmuyordu.
    3. Tür kodu satırında açıklama yokken tutar "ad" sanılıyordu. Artık tutarlar çıkarılıyor; ad bir üst açıklama satırından ya da bilinen tür adından geliyor.
    4. İcmal alt alta "etiket tutar" düzenindeydi; ayrıca "Damga Vergisi" başlığının altında "Ödenecek" vardı.
    5. Belge türü "S.M." / alt satırda "Makbuz" olunca 022 satırı atlanıyordu.
  - Sahte PDF'e bu düzende ikinci bir örnek eklendi (`muhtasar_ornek.GERCEK`) ve testi var.
  - Düzeltme gerçek metinle henüz sınanmadı; yöneticiden maskeli pypdf metni istendi.

### Değişen / yeni dosyalar (Faz 2)
| Dosya | Değişiklik |
|---|---|
| `fk/fatura_kontrol/detay.py` | Yeni: detay hazırlama, geçmiş indeksi, kurallar, kararlar, durum uygulama |
| `fk/fatura_kontrol/detay_rapor.py` | Yeni: denetim raporu HTML |
| `fk/fatura_kontrol/muhtasar_beyan.py` | Yeni: 1003A PDF okuma ve karşılaştırma |
| `fk/fatura_kontrol/denetim.py` | `denetle` → `v["detay"]` |
| `fk/fatura_kontrol/web/app.py` | `/api/denetim/detay` (GET), `/detay/karar`, `/detay/kural`, `/detay/rapor`; `/api/denetim/muhtasar` (POST / GET) |
| `fk/fatura_kontrol/web/static/denetim.html` | Detay denetim menüsü ve ekranları, kontrol ekranı, kurallar, rapor; muhtasar PDF yükleme ve karşılaştırma |
| `fk/requirements.txt` | `pypdf>=6.0` (saf Python). **Programın Python ortamına da girmeli**; kurulum bunu nasıl alıyor, sen bakmalısın |
| `web/denetim/wheels.txt` · `.github/workflows/site.yml` | `pypdf==6.17.0`; site testleri için `reportlab` |

### Testler (Faz 2)
- **`fk/tests/test_detay.py`** (9 test):
  - geçmişle uyumlu;
  - 4 uyumsuz durum;
  - kural ve karar önceliği;
  - toplu fişte faturalar karışmıyor;
  - API: karar, kural, rapor, yeniden denetimde kararlar kalıyor;
  - tarayıcıda kontrol ekranı: fiş, fatura çerçevesi, U ile karar, kural ekleme, kurallar listesi, rapor.
- **`fk/tests/test_muhtasar_beyan.py`** (4 test):
  - okuma;
  - çalışan bölümü ve kişisel veri yok;
  - başka / bozuk PDF reddedilir;
  - tek satırlı kişi tutarı;
  - API: karşılaştırma, PDF saklanmaz, kayıtta kişisel veri yok, rapor.
- **Köprü (Pyodide):** detay denetim ve muhtasar PDF'i tarayıcıda.
- **site_e2e:** Kontrol ekranı sitenin CSP'siyle; D ile karar; muhtasar PDF'i tarayıcıda okunuyor, kişisel veri yok.
- **Sonuçlar:**
  - **pytest:** 185 geçti. 16 hata `main` ile aynı ortam hataları.
  - **Site:** köprü 8/8, sürüm notu 6/6, site_e2e TAMAM.
  - **Luca fis-goster:** 20/20.
- **Elektron e2e bu ortamda çalışmıyor; yöneticinin çalıştırması gerekiyor.** Mevcut Denetim adımları değişmedi; yeni menü düğmeleri yalnız eklendi.

---

## FAZ 3 – Yönetici raporu (görsel)

Menüde **Detay denetim › Yönetici raporu → Raporu aç**: yazdırılabilir / PDF olarak kaydedilebilen tek sayfa. Masaüstünde ve sitede aynı kod. Kod: `fk/fatura_kontrol/yonetici.py` (hesap), `yonetici_rapor.py` (HTML), `/api/denetim/yonetici`.

Rapor, denetimin muavininden kurulan mizandan hazırlanır: yılbaşından denetlenen aya kadar, ay sonu bakiyeleri.

### 11. Aylık grafikler
Grafikler satır içi SVG; dış kütüphane yok. Çubuğun üzerine gelince tutar görünür. Grafik kurallarıyla:
- tek eksen;
- tek renk tonu: seçili ay koyu, önceki aylar açık;
- uyarı rengi yalnız vurgu için ve her zaman "▲" ve yazıyla birlikte;
- yuvarlak eksen değerleri;
- etiket yalnız seçili ayda ve vurgulu çubukta.

Grafikler:
- **Satışlar (600–602), ay ay:** her ayın altında önceki aya göre % değişim.
- **Giderler (7xx ana hesaplar), her hesap ayrı küçük grafik:**
  - 7x1 yansıtma ve 79x hesapları dahil değil;
  - vurgu: bir ay, önceki ayların ortalamasının 1,5 katından fazla ve aradaki fark en az 1.000 TL ise;
  - kartta neden yazar: "▲ Eylül: önceki ayların ortalamasının +450% üstünde".

### 12. O ayın özeti ve rasyolar
- **Kutular:**
  - satışlar (önceki aya göre %);
  - hesaplanan KDV (391) ve indirilecek KDV (191);
  - ödenecek ya da sonraki aya devreden KDV: önceki devreden 190 dikkate alınır; 190 ay sonu bakiyesi de yazar;
  - 360: tahakkuk eden, ödenen, bakiye;
  - 361 SGK: tahakkuk ve ödeme.
  - 360 alt hesap kırılımı tabloda.
- **Rasyolar** (her ay sonu için, formülleri tabloda yazılı):

  | Oran | Formül |
  |---|---|
  | Cari oran | 1xx ÷ 3xx |
  | Asit-test | (1xx − 15x) ÷ 3xx |
  | Nakit oranı | (10x + 11x) ÷ 3xx |
  | Borç / özkaynak | (3xx + 4xx) ÷ (5xx + dönem kârı) |
  | Kaldıraç | (3xx + 4xx) ÷ (1xx + 2xx) |
  | Net kâr marjı | dönem kârı ÷ net satışlar |
  | Brüt kâr marjı | (net satış − 62x) ÷ net satış |

  - Dönem kârı = 6xx ve 7xx'in yıl içi neti. Kapanış yapılmadan hesaplanır; 7/A yansıtma hesapları birbirini götürür.
  - Payda sıfır ya da eksi ise "—".
- **Uyarılar:**
  - Muavinde açılış fişi / devir yoksa: bilanço oranları yalnız yıl içi hareketlerle.
  - Muavin Ocak'tan başlamıyorsa: önceki aylar boş görünür.
  - Doğru oranlar için yıl başından itibaren, tüm hesapları içeren muavin gerekir. Yönetici gerçek Elektra dosyasını 6 aylık okuttu; bu tür yıllık muavinlerle tam çıkar.

### Testler (Faz 3)
- **`fk/tests/test_yonetici.py`** (4 test):
  - aylık satış ve değişim;
  - gider vurgusu;
  - o ayın KDV ve 360 tutarları;
  - rasyolar elle hesaplanan değerlerle aynı;
  - açılışsız muavinde uyarı;
  - HTML (2 grafik, ▲, formüller);
  - API ve 404.
- **Köprü:** yönetici raporu tarayıcıda.
- **Görsel kontrol:** 9 aylık sahte veriyle render edilip ekran görüntüsüyle bakıldı.
- **Sonuçlar:** pytest 190 geçti (16 hata main ile aynı ortam hataları); köprü 9/9; site_e2e TAMAM.
- **Gerçek veriyle denenmedi.**
