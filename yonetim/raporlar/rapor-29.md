# Rapor 29 – Luca sayfa yönetimi (açık konu 1, rapor-01 madde 4)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `b39e6be` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı; testler taklit pencere ve taklit Luca sunucusuyla. Arayüz (`renderer/app.js`) değişmedi.

## 1. Mevcut durum (`luca.js`, Görev 29 öncesi)
| Pencere | Nasıl açılır | Ne için |
|---|---|---|
| Giriş penceresi | `openLogin` → `LUCASSO/giris.erp` (kayıtlı bilgiyle gizli) | Giriş, doğrulama kodu |
| Ürün seçim → **Luca ana ekranı** | Girişten sonra "Mali Müşavir Paketi"ne basılır (`paketSec`); Luca ana ekranı yeni pencerede açılır | **Programın bütün işleri** (`appWindow()`): firma listesi, mizan, hesap planı, defter türü, fiş kesme, muavin, işletme listeleri. İstekler bu pencerenin içinden `fetch` ile gider |
| **"Luca'da Çalış"** (`calismaW`) | `calis()`: Luca'nın yeni pencere düğmesi; yoksa gizli ürün seçim sayfası (`ssoIleCalisma`); o da yoksa kullanıcı basar | Kullanıcının kendi çalışması; program bu pencereyi sorgularda kullanmıyordu (zaten doğruydu) |
| Gizli yardımcı pencereler | `muavinIndir`, `gizliPencere` (işletme listeleri) aynı oturumla `raporMizanDetayHazirla.do` vb. adresleri açar | İndirme / liste okuma |
| Toplu kontrol | Python (`fk/fatura_kontrol/luca/otomasyon.py`) **ayrı Chrome'da**; MuhaWin'in Luca çerezleriyle ürün seçim sayfasından kendi Luca ana ekranını açar | Toplu kontrol MuhaWin'in Luca pencerelerine dokunmuyor |

**Sorun:** Programın işleri tek ana ekranda yürüyor ve aralarında **sıra yoktu**.
- Her iş önce firmayı seçiyor (`TopFrameAction.do`, Luca'da üst çubuktan firma seçmekle aynı), sonra o firmanın verisini istiyor.
- İki iş aynı anda başlarsa (ör. fiş aktarımı sürerken başka firmanın muavini ya da hesap planı) ikinci işin firma seçimi birincinin isteklerini başka firmaya kaydırabiliyordu.
- Testte bu yarış yeniden üretildi: kilit kapatılınca fiş, istenen dönem yerine öbür firmaya kesiliyor.

## 2. Tasarım
1. **"Luca'da Çalış" ayrı pencere:** Değişmedi. Program bu pencerede hiçbir istek yapmıyor; kullanıcı orada istediği firma ve ekrana geçebilir.
2. **Ortak sayfa:** Programın bütün Luca işleri tek ortak sayfada (girişte açılan Luca ana ekranı) yürür.
   - Her iş sayfayı alıp bırakıyor (`isle` → `sayfaAl` / `sayfaBirak`). Kuralı yürüten bilgi `AsyncLocalStorage` ile işin içindeki bütün çağrılara taşınıyor: hangi sayfanın kullanılacağı (`isSayfasi()`).
   - Firma seçen işler firma anahtarıyla (Luca firma kimliği + yıl) çalışıyor.
   - **Aynı firmanın** işleri sayfayı paylaşabiliyor.
   - **Başka firmanın** işi, sayfa boşalıp kısa **kira süresi** (60 sn) dolmadan o sayfada firma değiştiremiyor. Kira, fiş aktarımında fişler arasındaki boşluklarda firmanın korunması için.
   - Firma seçmeyen işler (firma listesi, mizan, döviz kodları) beklemiyor.
3. **Ek sayfa:** Ortak sayfa başka firmanın işiyle doluyken yeni bir iş gelirse ortak sayfadaki **Luca'nın kendi "yeni pencere" düğmesine** basılıyor. Bu, firma / dönem çubuğunun altındaki beyaz düğme; `luca.do` doğrudan açılırsa boş sayfa geliyor.
   - Açılan Luca ana ekranı **gizli** ek sayfa oluyor. İş orada yürüyor, sonra ek sayfa havuzda kalıyor.
   - En çok 2 ek sayfa açılıyor; 2 dakika boş kalan kapanıyor.
   - Düğme bulunamazsa iş ortak sayfada sıraya giriyor (en çok 15 dk bekler, sonra "Luca başka bir işle meşgul" hatası).
4. **Ayrılık sınaması:** İlk ek sayfada, ek sayfa firma seçerken ortak sayfanın Luca'daki seçimi okunuyor (`YMFrameAction.do` içindeki `__SESSION` firma / dönem alanları). Bu, sayfaların Luca'da gerçekten ayrı çalıştığını program içinden doğrulamak için.
   - **Ortak sayfanınki değişmediyse ve ek sayfanınki farklıysa:** Sayfalar ayrı çalışıyor; ek sayfalar bu program açıklığı boyunca kullanılıyor.
   - **Ortak sayfanınki de değiştiyse** (aynı Luca oturumu): Ortak sayfanın firması hemen geri seçiliyor, ek sayfalar kapanıyor ve iş ortak sayfada sıraya giriyor. Bu oturumda yeniden ek sayfa açılmıyor.
   - **Bilgi okunamazsa:** Aynı güvenli yol izleniyor (sıra). Durum ana sürece `sayfalar` olayıyla bildiriliyor.
5. **Fiş kesme:** Her fiş kesilmeden önce o sayfada fişin dönemi seçili mi bakılıyor; değilse (kira dolup başka iş geldiyse) dönem yeniden seçiliyor. Fiş her durumda istenen firmaya kesiliyor.
6. **Gizli yardımcı pencere açan işler yalnız ortak sayfada:** Muavin indirme ve işletme gelir / gider listeleri. Bu pencerelerin ek sayfanın Luca bağlamını görüp görmediği bilinmiyor; doğrulanınca açılabilir.
7. **Toplu kontrol:** Python, ayrı Chrome'da ve kendi Luca ana ekranıyla çalışmaya devam ediyor. Zaten "ek iş = ayrı sayfa" kuralına uyuyor; MuhaWin'in ortak ya da ek sayfalarına dokunmuyor. Toplu kontrolü MuhaWin'in ortak sayfasına taşımak, Playwright otomasyonunun Electron içinde yeniden yazılması demek; bu görevin dışında bırakıldı.

## 3. Değişen dosyalar
- `luca.js`:
  - **Sayfa havuzu:** `isle`, `sayfaAl`, `sayfaBirak`, `ekSayfaAc`, `ekSahiplen`, `ayrilikSina`, `oturumOku`, `sayfaBilgisi`.
  - **Var olan fonksiyonlar:** `appWindow` ek sayfaları dışarıda bırakıyor; işler `isSayfasi()` kullanıyor. `prepareFis` sayfanın seçimini kaydediyor; `fisKes` gerekirse dönemi yeniden seçiyor. Ek sayfa gizli açılıyor.
  - **Dışa açılan işler** havuzdan geçiyor (`IS`).
  - `main.js`'teki çağrılar aynı kaldı.
- `test/luca/sayfa-yonetimi.js` (yeni).

## 4. Testler
| Test | Sonuç |
|---|---|
| `node test/luca/sayfa-yonetimi.js` (yeni; CI'daki `test/luca/*` döngüsünde) | **15/15** |
| `test/luca/*.js` (11 dosya) | hepsi geçti |
| `node test/mobil.js` | 45/45 |
| `xvfb-run -a node test/e2e.js` | **286 geçti, 0 başarısız** |

`sayfa-yonetimi.js` neyi sınıyor:
- **Ayrı oturumlu Luca:**
  - BETA işi yeni pencere düğmesiyle açılan gizli ek sayfada yürüyor, ortak sayfada ALFA korunuyor.
  - Aynı anda kesilen ALFA ve BETA fişleri doğru firmada.
  - `status` ortak sayfayı gösteriyor.
- **Paylaşılan oturum:** Sınama yakalıyor; ortak firma geri seçiliyor; iş sıraya giriyor; fişler yine doğru firmada; yeni ek sayfa açılmıyor.
- **Aynı firma:** Ek sayfa açılmıyor. Düğme yoksa iş sıraya giriyor; sonraki fişte firma yeniden seçiliyor.
- **Firma listesi:** Kirayı beklemiyor.
- **Bozma denemesi:** Kilit kaldırılınca fişler yanlış firmaya kesiliyor ve test bunu yakalıyor (7 denetim kırılıyor).

## 5. Kullanıcının gerçek Luca'da deneyeceği adımlar
Program bu sürüm derlendikten sonra (derleme kullanıcı isteyince).

1. **Hazırlık:** MuhaWin'de "Luca'ya giriş" ile bağlanın ("● Luca bağlı"). En az iki firması olan bir hesap kullanın (ALFA ve BETA).
2. **Luca'da Çalış:** Üst şeritte "Luca'da Çalış"a basın. Tam ekran ayrı Luca penceresi açılmalı. Orada firmayı değiştirin, sonra MuhaWin'e dönüp ALFA'nın mizanını yenileyin. Mizan **ALFA'nın** olmalı. Çalışma penceresindeki firma değişmemeli.
3. **Aynı anda iki iş (ek sayfa):**
   - ALFA için Banka ekranından Luca'ya fiş aktarımını başlatın.
   - Aktarım sürerken BETA için **Mizan / Muavin / Hesap Planı → hesap planını yenile** (ya da BETA'nın mizanı).
   - **Beklenen:** İkinci iş beklemeden başlar; ekranda yeni Luca penceresi görünmez (arka planda açılır).
   - **Kontrol:** Aktarılan fişler Luca'da **ALFA**'da, hesap planı **BETA**'nın olmalı.
4. **Firma karışmadı mı:** Luca'da (Luca'da Çalış penceresinde) ALFA'nın fiş listesine bakın. 3. adımda kesilen fişler orada, BETA'da yok olmalı.
5. **Sıra:** 3. adımı muavin indirmeyle tekrarlayın (ALFA aktarımı sürerken BETA muavini). Muavin, aktarım bitip en geç 1 dakika sonra başlar (muavin ortak sayfada sırayla yürür).
6. **Sorun olursa:**
   - Belgeler → MuhaWin → `muhawin-modul.log` ve Ayarlar → Hata Günlüğü'nü gönderin.
   - Bir işin yanlış firmanın verisini getirdiğini görürseniz programı kapatıp yeniden açın. Program ikinci sayfayı yalnız sayfaların ayrı çalıştığı sınandıktan sonra kullanır, ama bu bilgi bizim için önemli.

## 6. Riskler ve açık konular
- **Sınamanın varsayımı:** Luca'nın `__SESSION` bilgisinde firma / dönem alanları bulunduğu varsayılıyor (hesap planı raporunda bu bilgi zaten kullanılıyor). Alan yoksa sınama "okunamadı" der ve ek sayfa hiç kullanılmaz: işler doğru ama sırayla yürür. 5. adımdaki davranış bunu gösterir.
- **Gizli yardımcı pencereler:** Muavin ve işletme listeleri ortak sayfayla sınırlı (bkz. 2.6). Gerçek Luca'da ek sayfanın gizli pencereyle aynı firmayı gördüğü doğrulanırsa açılabilir.
- **Kira süresi:** Fiş aktarımında iki fiş arasında 60 sn'den uzun beklenirse (ör. onay penceresi açık bırakılırsa) başka firmanın işi ortak sayfayı alabilir. Sonraki fiş kesilmeden dönem yeniden seçildiği için fiş yine doğru firmaya gider.
- **Kaynak:** Ek sayfa ikinci bir Luca ana ekranı demek; en çok 2 tane, 2 dakika boşta kalınca kapanıyor.
