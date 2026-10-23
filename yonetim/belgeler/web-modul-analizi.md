# Web modülleri analizi (Görev 04, Aşama C)

Hazırlayan: Web Asistanı · 23.10.2026 · Dal: `claude/beautiful-bohr-c7x9ij`
Programdan modül kaldırılmadı. Bu belge yalnız analiz ve öneri içerir.

## 0. Özet
- **Mikro Denetim tarayıcıda çalışabiliyor; bu denendi.** `fk/fatura_kontrol` içindeki Python kodu, tarayıcıdaki Python motoru **Pyodide** üzerinde **değiştirilmeden** çalıştı. Sonuç sunucu sürümüyle aynı çıktı (sahte örnek verilerle: KDV 0, Matrah 1, Cari 1 sorun) ve Excel raporu da üretildi. Denetim süresi yaklaşık 1,6 sn. İlk açılışta yaklaşık 6 MB (sıkıştırılmış) indirilir, sonraki açılışlarda tarayıcı önbelleğinden gelir. Bu yolda **belge bilgisayardan çıkmaz** ve kural ihlali yoktur.
- Tek engel bir kod bağımlılığı: `kontrol.py`, raporu kaydetmek için web sunucusu modülünü (`web/app.py`: FastAPI, sqlite3, Luca/Playwright zinciri) içe aktarıyor. Denemede bu modüller boş taslaklarla geçildi. Kalıcı çözüm, `rapor_kaydet`'in ayrı bir modüle alınması (Yazılımcı işi; bkz. W1).
- **Kullanıcı kararı (23.10.2026): belgeler tarayıcıda işlenir (T).** Bu dalda önceden hazırlanan sunucu sürümü (FK_WEB=1, belgeleri sunucuda saklıyordu) bu karar üzerine kaldırıldı; `fk/` bu PR'da değişmiyor.
- Luca'ya bağlanan her iş (Playwright / Electron Luca penceresi) web'e taşınamaz. Luca, oturumu ve captcha'yı başka bir alan adından tarayıcıya açmaz (CORS, çerez yalıtımı). Bunu yapmak için kullanıcı adına sunucuda Luca'ya giriş yapmak gerekirdi; bu da Luca bilgilerini ve müşteri verisini sunucuya taşımak demek. Önerilmez.

## 1. Modüller

Kısaltmalar. **R**: renderer (`renderer/index.html`, tarayıcı JS). **P**: Python yan süreci (`fk/`, FastAPI 127.0.0.1). **L**: Luca (luca.js Electron penceresi ya da Playwright). **IPC**: Electron ana süreci (`main.js`; dosya, OCR, yerel depo).

| Modül | Bugün nerede | Tarayıcıda çalışır mı | Engeller | Gerekli sunucu işi | Büyüklük |
|---|---|---|---|---|---|
| **Denetim** (bugün "Mikro Denetim", Ofisinize Özel; başka programlarla genişletilecek) | P (`denetim.py`, `kontrol.py`, `/api/denetim*`) + R sayfası (`static/denetim.html`) | **Evet, denendi (Pyodide)** | `kontrol.py` → `web/app.py` bağımlılığı. Kalıcı veri için tarayıcı deposu (IndexedDB) ya da kullanıcının seçtiği klasör (File System Access API). Fatura görüntüsü (`goruntu.py`, lxml) yerine tarayıcının kendi XSLT'si kullanılır | Yok (yalnız giriş + lisans, Supabase) | **M** |
| KDV 1 / KDV 2 beyannamesi, çıktı raporu (Mikro Denetim içinde) | P (`beyanname.py`, `cikti.py`) | Evet (aynı Pyodide paketi) | W1 ile birlikte gelir | Yok | W1'e dahil |
| Fatura – Muavin Kontrol, **dosyadan** (Muhasebe İşlemleri › tek firma) | P | Evet (aynı kod) | Luca'dan fatura/muavin indirme ve Luca'ya kayıt tarayıcıda olmaz; yalnız dosya yükleme | Yok | M (W1'den sonra S) |
| Fatura – Muavin Kontrol, Luca'dan indirme / toplu kontrol / Luca'ya kayıt | P + L (Playwright) | **Hayır** | Luca otomasyonu, captcha, yerel Chrome | — | — |
| **Banka İşlemleri** (ekstre → Luca fişi) | R (xlsx, pdf.js, kurallar) + IPC (yerel depo) + L (mizan çekme, fiş kesme) | Kısmen: ekstre okuma, kurallar ve **Luca Excel fişi** tarayıcıda olur | Kod 6.500 satırlık `renderer/index.html` içinde; ayrıştırma gerekir. Mizan Luca'dan değil Excel'den yüklenir. Kurallar şu an yerel depoda; bilgisayarlar arası paylaşım için Supabase (`bulut-veri-tasarimi.md`) | Kurallar için Supabase tabloları + RLS | L |
| **Hızlı Fiş Girişi** (ÖKC, Z raporu, yurt dışı fatura) | IPC (tesseract.js, `ocr_onisle.js` Electron nativeImage, `kur.js` TCMB) + R | Evet, iki ek işle | OCR ön işleme canvas'a taşınır; tesseract.js tarayıcıda çalışır (WASM). TCMB kur XML'i tarayıcıdan okunamaz (CORS) | **Küçük bir kur aktarıcı** (Cloudflare Worker; yalnız TCMB XML, müşteri verisi geçmez) | M |
| Çek / Senet Kayıtları (Ofisinize Özel) | R (`CEK`, index.html ~4403) + L (muavin, fiş) | Kısmen: Logo/Mikro Excel okuma, rapor ve Luca Excel fişi olur | Luca muavini Excel'den yüklenir; kod index.html'den ayrıştırılmalı (sıra kuralı: index.html'e dokunan görevler sırayla) | Yok | M |
| Denetim ve Analiz: Ters bakiyeli hesaplar, Banka bakiye mutabakatı, Günün özeti | R (`MMUI`, `BMUT`, `OZET`) üzerinden Luca'dan çekilmiş mizan/muavin | Ters bakiye ve banka mutabakatı **mizan/muavin Excel'i yüklenerek** olur. Günün özeti programın iş günlüğüne bağlı, olmaz | Veri Luca'dan çekiliyor; web'de yükleme ekranı gerekir | Yok | S–M |
| Mizan / Muavin / Hesap planı çekme | L | Hayır | Luca otomasyonu | — | — |
| Yönetim (üyeler, lisans, kodlar) | R (`yonetim.js`) + Supabase RPC | **Zaten var**: `mobil-yonetim/` (web) | — | Yok (Supabase) | Hazır (`yonetim.` alt adı) |
| WhatsApp belge alma | Supabase Edge (`sunucu/edge/whatsapp-*`) + IPC | Kısmen | Görev 06 (güvenlik) beklenmeli | Var (Edge) | — |
| Üyelik / giriş / lisans | IPC (`cloud.js` → Supabase Auth + `rpc/app_status`, `activate_code` …) | Evet | Tarayıcıda anon anahtar + kullanıcı oturumu (JWT) kullanılır; yetki RLS ve RPC'lerde denetlenir. **`service_role` istemciye konmaz.** Oturum `localStorage` yerine bellekte + yenileme belirteci ile tutulmalı (XSS riski) | Yok; mevcut RPC'ler yeter, gerekirse web için bir RPC | S |

## 2. Sitede lisans ve üyelik (Supabase)
- Giriş: `POST {SUPA}/auth/v1/token?grant_type=password` (anon anahtar ile). Masaüstündeki `cloud.js` de aynısını yapıyor; anon anahtar zaten herkese açık (`mobil-yonetim/index.html`).
- Lisans: kullanıcının JWT'siyle `rpc/app_status` (modül listesi ve bitiş tarihleri). Web modülü açılmadan önce ilgili modülün lisansı denetlenir.
- Güvenlik sınırı: Tarayıcıdaki denetim kodu kullanıcının elinde olduğu için lisans denetimi tarayıcıda "atlatılabilir". Belge zaten kullanıcıda kaldığından sızan bir veri yoktur; risk yalnız lisanssız kullanımdır (masaüstü programdakiyle aynı düzey). Daha sıkı bir koruma isteniyorsa, Python paketinin indirilmesi lisanslı JWT ile imzalı adrese bağlanabilir (Worker; S).
- Ortak veriler (kurallar, ayarlar) için `bulut-veri-tasarimi.md` taslağı geçerli; web modülleri de aynı tabloları kullanır.

## 3. Önerilen ilk modüller ve görev kartı taslakları

### W1 – Denetim tarayıcıda (önerilen ilk iş)
- **Kullanıcı kararı (23.10.2026):** İlk geçecek modül Denetim. Denetim yalnız Mikro'ya bağlı kalmayacak; **başka muhasebe programlarının evraklarıyla genişletilecek.** Bu yüzden web sürümü baştan "program seçmeli" kurulur:
  - **Faturalar program bağımsız:** e-Fatura / e-Arşiv XML'i (UBL-TR) hangi programdan alınırsa alınsın aynıdır; okuyucu ortak (`fatura_okuyucu.py`).
  - **Değişen yalnız muavin ve red/iptal listesi:** Muavin okuyucuları `muavin_programlari.py` → `PROGRAMLAR` sözlüğünde kayıtlı (bugün `luca`, `mikro`, işletme defterleri). Yeni bir program (ör. Logo, Netsis, Zirve, ETA) için bir okuyucu fonksiyonu ve bir kayıt eklemek yeter; denetim kuralları değişmez. Red/iptal okuyucusu (`red_iptal.py`) bugün Mikro'nun Excel sütunlarına göre; diğer programlar için aynı kayıt düzeni kurulmalı.
  - **Sayfada program seçimi:** `denetim.html` bugün `program=mikro` sabit gönderiyor ve başlık/etiketlerde "Mikro" yazıyor. Web sürümünde program listesi `/api/muavin/programlar`'dan (`programlar()`) gelir; etiketler seçilen programın `ad` / `ipucu` alanlarından yazılır. Masaüstündeki "Mikro Denetim" kartı da aynı sayfayı kullandığı için bu değişiklik programa da yarar (adı "Denetim" olur).
  - **Her yeni program ayrı küçük bir iştir (S):** okuyucu + o programın **sahte** örnek dışa aktarım dosyasıyla test. Kullanıcıdan her program için sütun düzenini gösteren örnek (gerçek veri çıkarılmış) bir dosya ya da ekran görüntüsü istenir.
- **Neden:** Kullanıcı doğrudan istedi ("Mikro Denetim gibi Luca'sız bölümleri siteden kullanacağım"). Kod hazır ve tarayıcıda çalıştığı kanıtlandı.
- **Ön koşul (Yazılımcı, `fk/`):** `rapor_kaydet` ve `_json`'u `web/app.py`'den yeni `fatura_kontrol/rapor_kayit.py` modülüne taşımak. `kontrol.py` artık `web.app`'i içe aktarmaz; geçmiş kaydı (sqlite) isteğe bağlı olur. Masaüstü davranışı değişmez; pytest aynı sonucu verir. Dokunulacak dosyalar: `fk/fatura_kontrol/kontrol.py`, `fk/fatura_kontrol/web/app.py`, yeni `fk/fatura_kontrol/rapor_kayit.py`. (S)
- **Web Asistanı:**
  - `web/site/denetim/index.html`: `fk/.../static/denetim.html`'den derleme adımıyla kopyalanır. Kaynak tek kalır; sayfaya yalnız bir "tarayıcı köprüsü" eklenir.
  - `web/site/denetim/calisan.js`: Web Worker; Pyodide, wheel'ler ve `fatura_kontrol` paketi `site/denetim/py/` altından yüklenir, CDN gerekmez.
  - `kopru.js`: Sayfanın `fetch('/api/denetim…')` çağrılarını Worker'daki Python fonksiyonlarına yönlendirir; böylece sayfa kodu neredeyse hiç değişmez.
  - Veri: IndexedDB (IDBFS). Chrome/Edge'de isteğe bağlı olarak "bilgisayardaki klasörü kullan" (File System Access API).
  - `tools/site_uret.js` → `fk/fatura_kontrol` paketini zip'leyip `site/denetim/py/`'ye koyar.
- **Test:** Node + Pyodide (`web/tarayici-deneme/deneme.mjs`) ile `tests/test_denetim.py` senaryosu, Playwright ile sayfa uçtan uca.
- **Büyüklük:** M (Yazılımcı S + Web Asistanı M). Sunucu yok; Cloudflare Pages yeter.

### W2 – Site girişi ve lisans denetimi (W1 ile birlikte, ortak altyapı)
- `web/site/ortak/oturum.js`: Supabase e-posta/parola girişi, oturum yenileme, `app_status` ile modül lisansı, çıkış. Giriş sayfası `web/site/giris.html`.
- Parola sıfırlama: Supabase "recover" (masaüstündeki `auth-recover` ile aynı).
- Dokunulacak dosyalar: yalnız `web/site/`. Supabase'de değişiklik gerekmez; gerekirse web için bir RPC, Yazılımcı/kullanıcı onayıyla.
- **Büyüklük:** S.

### W3 – Hızlı Fiş Girişi (yurt dışı fatura + ÖKC) tarayıcıda (W1'den sonra)
- OCR: tesseract.js tarayıcı sürümü + Türkçe dil dosyası (site ile birlikte sunulur). `ocr_onisle.js`'deki ön işleme canvas'a taşınır (Electron nativeImage yerine).
- TCMB kuru: Cloudflare Worker (`/kur?tarih=`) TCMB XML'ini aktarır; `kur.js`'deki "önceki iş günü" kuralı Worker'a taşınır. Müşteri verisi Worker'dan geçmez.
- Çıktı: Luca Excel fiş aktarım dosyası (programdaki biçim).
- Ön koşul: OCR/fiş kodunun `renderer/index.html`'den ayrı bir dosyaya alınması (Yazılımcı; index.html sıra kuralına tabi).
- **Büyüklük:** M–L. Kullanıcı isterse W3 yerine Çek/Senet (M) ya da Ters bakiye + banka mutabakatı (S–M) alınabilir.

## 4. Kullanıcı kararı bekleyenler
1. ~~T / S1 / S2~~ → **T (tarayıcı), kullanıcı kararı 23.10.2026.**
2. İlk modül sırası (önerilen: W1 + W2, sonra W3).
3. Masaüstündeki modüller programdan kaldırılacak mı? Öneri: **kaldırılmasın.** Web sürümü ek erişim yolu olsun; kaldırma kararı kullanıcıda.

## Deneme kaydı (yeniden üretmek için: `web/tarayici-deneme/`, adımlar `deneme.mjs` başında)
- Pyodide 0.27.2 (npm) + PyPI wheel'leri: openpyxl 3.1.5, et_xmlfile 2.0.0, xlrd 2.0.2. Hepsi saf Python.
- `fastapi`, `pydantic`, `sqlite3` ve `playwright` boş modüllerle geçildi; W1'in ön koşulu bunu gereksiz kılacak.
- Girdi: `tests/test_denetim.py` ve `tests/test_luca_otomasyon.py`'deki **sahte** üreticilerle hazırlanan ZIP + Mikro muavini. Gerçek müşteri verisi kullanılmadı.
- Boyut: `pyodide.asm.wasm` 9,7 MB (gzip 3,0 MB), `python_stdlib.zip` 2,3 MB (gzip 2,2 MB), wheel'ler 0,36 MB, `fatura_kontrol` 0,86 MB.
