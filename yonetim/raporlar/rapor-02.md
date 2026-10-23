# Rapor 02 – Güvenlik Denetimi

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `cfed419` (2.9.12 + Görev 03) · **Dal:** `claude/awesome-ritchie-ftviuk`. Oturum ortamı bu dalı zorunlu kılıyor.
**Tür:** Yalnız okuma. Kod değiştirilmedi, derleme yapılmadı. Gerçek Luca, GİB, Supabase ya da GitHub'a deneme isteği gönderilmedi.

## Özet
| Önem | Sayı |
|---|---|
| Kritik | 1 |
| Yüksek | 3 |
| Orta | 11 |
| Düşük | 16 |

En acil üç iş:
1. **K1:** Fatura görüntülemedeki XSLT açığı kapatılmalı. Kötü niyetli bir e-fatura diske dosya yazabiliyor.
2. **Y1:** PDF okuyucu güncellenmeli ya da `isEvalSupported:false` verilmeli.
3. **Y2, Y3:** WhatsApp numara ele geçirme açığı ve webhook imza denetimi düzeltilmeli.

Dört iş de küçük (S) boyutta.

## Bulgular
Kanıt: **D** = Doğrulandı (kod satırı + yerel deneme) · **O** = Olası (koddan çıkarıldı, denenmedi). İş: S / M / L.

### Kritik ve Yüksek
| No | Önem | Kanıt | Dosya:satır | Sorun | Etki | Önerilen düzeltme | İş |
|---|---|---|---|---|---|---|---|
| K1 | Kritik | D | `fk/fatura_kontrol/goruntu.py:61-70`; `fk/fatura_kontrol/web/app.py:878-895`; `main.js:539`; `sidecar.js:107-115` | Faturaya gömülü XSLT şablonu imza denetimi ve erişim kısıtı olmadan `etree.XSLT` ile çalıştırılıyor. Yerel denemede `goruntu_html()` üzerinden `exsl:document` diske istenen yola dosya yazdı. Şablondaki `<script>` çıktıya geçti. Çıktı, JavaScript'i açık bir pencerede (`fk-fatura-pdf`) yükleniyor. Bu pencere varsayılan oturumu kullandığı için yerel API anahtarı (`X-MuhaWin`) isteklerine otomatik ekleniyor. | Müşteriden gelen tek bir kötü niyetli e-fatura "Faturayı görüntüle"de kullanıcı yetkisiyle diske dosya yazar. Windows Başlangıç klasörüne yazarsa sonraki oturumda kod çalışır. Gömülü script yerel API'yi çağırabilir (ör. `/api/verileri-sil`). | `etree.XSLT(..., access_control=etree.XSLTAccessControl.DENY_ALL)`; `exsl`/extension elemanlarını reddet. `fk-fatura-pdf` penceresine `javascript:false`, `/api/fatura/goruntu` yanıtına `Content-Security-Policy: script-src 'none'`. | S |
| Y1 | Yüksek | O | `renderer/vendor/pdf.min.js` (3.11.174); `renderer/index.html:485, 2982, 3927` | PDF.js 3.11.174, kötü niyetli PDF ile JavaScript çalıştırma açığına (CVE-2024-4367, 4.2.67'de düzeltildi) açık. `getDocument` çağrılarında `isEvalSupported:false` yok. `npm audit`: `pdfjs-dist <=4.7.76` yüksek. | Banka ekstresi ya da fiş olarak gelen bir PDF, ana pencerede `window.desktop` köprüsüyle kod çalıştırabilir: dosya kaydetme, Luca bilgileri, veri silme. | Hemen: her `getDocument({...})` çağrısına `isEvalSupported:false`. Sonra: vendor pdf.js'yi güncel sürüme yükselt. | S |
| Y2 | Yüksek | D | `sunucu/supabase-whatsapp.sql:62-70` (`on conflict … do update set office_id`); `sunucu/supabase-ofis.sql:160-171` | Herhangi bir ofis yöneticisi başka bir ofisin WhatsApp `phone_number_id` kaydını kendi ofisine taşıyabiliyor. Her kullanıcı `office_create` ile ofis yöneticisi olabiliyor. Yerel PostgreSQL denemesinde kurbanın sonraki fişi saldırganın listesine düştü. | Mükellef fiş görselleri ve telefon numaraları (KVKK kişisel verisi) başka ofise akar. | `on conflict do nothing`; kayıt başka ofise aitse hata ver. Bağlamayı yalnız yönetici yapsın ya da Meta API ile sahiplik kanıtlansın. | S |
| Y3 | Yüksek | O | `sunucu/edge/whatsapp-webhook/index.ts:30-38` (`--no-verify-jwt`, :2) | POST isteklerinde `X-Hub-Signature-256` HMAC denetimi yok. Fonksiyon `service_role` yetkisiyle çalışıyor. | Sahte webhook gövdeleriyle ofis numarasından istenen numaraya yanıt gönderme (`yanitla`, :23-28, :52), veritabanı ve Graph API yükü. | `WA_APP_SECRET` ile ham gövde üzerinde HMAC-SHA256; sabit zamanlı karşılaştırma; uyuşmazsa 401. | S |

### Orta
| No | Önem | Kanıt | Dosya:satır | Sorun | Etki | Önerilen düzeltme | İş |
|---|---|---|---|---|---|---|---|
| O1 | Orta | O | `main.js:105-129` | Ana pencerede `will-navigate` engeli yok; yalnız yeni pencere açma denetleniyor. Preload bütün gezinmelerde yüklenir. | Bir XSS ya da yönlendirme ana pencereyi uzak bir sayfaya götürürse o sayfa tüm `window.desktop` API'sine erişir. | `will-navigate`'te `index.html` dışını engelle ve `shell.openExternal` ile aç. | S |
| O2 | Orta | D | `renderer/index.html:4`; `renderer/splash.html:3` | CSP'de `script-src 'unsafe-inline'` var. İncelenen `innerHTML` yerlerinde `esc()` kullanılıyor; ham enjeksiyon bulunmadı. | XSS'e karşı CSP koruması etkisiz; preload API'siyle birleşince etki büyür. | Satır içi script'leri dosyaya taşı, nonce tabanlı CSP. (Görev 01 sonrasına) | M |
| O3 | Orta | O | `main.js:353` (`open-mail`) | `shell.openExternal(url)` gelen her adresi açıyor; çağıranlar yalnız `mailto:` kuruyor. | Arayüz ele geçirilirse tehlikeli protokol işleyicileri tetiklenebilir. | `mailto:` / `https:` beyaz listesi. | S |
| O4 | Orta | D | `sunucu/supabase-ofis.sql:120-125`; `sunucu/supabase-yonetim.sql:466-475` | Deneme süresi modül modül zincirlenebiliyor. `app_status(…,'fatura'/'okc'/'ozel')` her çağrıda yeni 7 gün açıyor; TEK LİSANS kuralı en geç bitişi tüm modüllere uyguluyor. | Yerel denemede bir hesap 7 yerine yaklaşık 28 gün deneme aldı. | Hesap başına tek deneme, ya da `trial_end` yalnız `profiles.trial_start`'tan hesaplansın. | S |
| O5 | Orta | D | `cloud.js:94-97, 156-158, 199-207` | Çevrimdışı önbellek `oturum.bin` imzasız. Şifre çözme başarısız olunca düz metne düşülüyor (`dec()` catch). | Yerel denemede elle yazılan önbellekle çevrimdışı giriş `valid:true`, 26.732 gün oldu: çevrimdışı lisans atlatma. | Sunucu `app_status` yanıtını imzalasın (Ed25519), istemci doğrulasın; düz metin geri dönüşü kalksın. Masaüstü istemcide bu yalnız çıtayı yükseltir. | M |
| O6 | Orta | D | `cloud.js:98-103`; `sunucu/supabase-ofis.sql:106-117` | Cihaz kimliği, istemcinin ürettiği rastgele UUID (`cihaz.json`). | Dosya kopyalanınca birden çok bilgisayar tek cihaz sayılıyor; `max_devices` etkisiz. | Donanıma bağlı kimlik (MachineGuid özeti) ya da sunucunun verdiği cihaz belirteci, eşzamanlı oturum sınırı. | M |
| O7 | Orta | D | `sunucu/supabase-ofis.sql:6, 53-56, 185-204` | Bir ofis lisansı sınırsız sayıda çalışan hesabına yayılıyor. Yorumlara göre bilinçli ("kullanıcı sınırı yok"). | İş modeli kararı: lisans çok kişiyle paylaşılabilir. | İstenmiyorsa ofis başına kullanıcı sınırı. **Kullanıcı kararı.** | S |
| O8 | Orta | O | `fk/fatura_kontrol/fatura_okuyucu.py:552-571`; `fk/fatura_kontrol/web/app.py:148-160, 1011-1019` | İç içe ZIP'e sınırsız özyineleme; `z.read()` tamamını belleğe açıyor; yükleme boyutu sınırı yok. | Zip bombası ya da çok büyük dosya belleği ve diski tüketir (yerel DoS). | Derinlik ve toplam açılmış boyut sınırı (`ZipInfo.file_size`), yükleme üst sınırı. | M |
| O9 | Orta | O | `package.json:73-83` (`win`), `:99-106` (`publish`) | Sertifika ayarı yok (`certificateFile` / `CSC_LINK`); kurulum dosyası büyük olasılıkla imzasız. Güncelleme bütünlüğü yalnız aynı GitHub sürümündeki `latest.yml` sha512 değerine dayanıyor. Güncelleme adresi sabit; çalışma anında değiştirilemiyor (iyi). | `muhawin/muhawin-surumler` sürümlerine yazabilen biri tüm kullanıcılara kod dağıtabilir. SmartScreen uyarısı. | Kod imzalama sertifikası + `publisherName`; sürüm deposunda 2FA ve dal koruması. | L |
| O10 | Orta | O | `package.json` (`electron ^31.7.7`) | Electron 31 destek dışı; Electron yalnız son 3 ana sürümü güncelliyor. | Chromium/V8 açıkları kapanmıyor. | Güncel ana sürüme yükseltme ve tam test. | M |
| O11 | Orta | O | `luca.js:662-668`; `renderer/vendor/xlsx.full.min.js` (0.18.5) | `xlsx 0.18.5`: prototip kirletme ve ReDoS (npm audit yüksek; npm'de düzeltme yok). | Luca'dan ya da kullanıcıdan gelen bozuk Excel ana süreçte ya da arayüzde beklenmedik davranış veya donma. | SheetJS'in kendi CDN'indeki 0.20.x sürümüne geçiş. | M |

### Düşük
| No | Önem | Kanıt | Dosya:satır | Sorun | Önerilen düzeltme | İş |
|---|---|---|---|---|---|---|
| D1 | Düşük | D | `sunucu/supabase-whatsapp.sql:77`; `sunucu/supabase-yonetim.sql:24-28, 555` | `wa_*` fonksiyonları ve `_is_admin` için `anon`'dan EXECUTE yetkisi alınmamış (bugün etkisiz). | `revoke all on function … from public, anon` | S |
| D2 | Düşük | D | `sunucu/supabase-ofis.sql:130-157, 206-226` | `activate_code` ve `office_join`'de deneme sınırı yok. Kodlar 250 / ~59 bit, pratik risk düşük. | Kullanıcı başına hata sayacı | S |
| D3 | Düşük | D | `sunucu/supabase-ofis.sql:218` | `office_join` hata mesajında davet edilen e-postayı açıklıyor. | Genel hata mesajı | S |
| D4 | Düşük | O | `sunucu/edge/whatsapp-webhook/index.ts:12, 33` | `WA_VERIFY_TOKEN` tanımsızsa boş belirteç doğrulamayı geçiyor. | Boşsa her zaman 403 | S |
| D5 | Düşük | O | `mobil-yonetim/uygulama.js:14, 48, 524-528` | Yöneticinin yenileme belirteci `localStorage`'da; GitHub Pages'te aynı origin'i paylaşan sayfalar var. XSS bulunmadı. | `sessionStorage` / bellek ya da ayrı alan adı | S |
| D6 | Düşük | O | `main.js:89-100` | "Beni hatırla" düz parolayı DPAPI ile saklıyor; aynı Windows kullanıcısındaki süreçler çözebilir. | Parola yerine yenileme belirteci | M |
| D7 | Düşük | O | `sunucu/supabase-yonetim.sql:524-537`; `cloud.js:83-91, 263-266` | Varsayılan yönetim PIN'i `5555…`; PIN yalnız arayüz kapısı (asıl denetim `_chk()` doğru). | İlk girişte değiştirme zorunlu; TOTP / `aal2` | M |
| D8 | Düşük | O | `sunucu/supabase-ofis.sql:99-128` | `p_device`, `p_name`, `p_version` uzunluk sınırsız. | `left(…,100)` / CHECK | S |
| D9 | Düşük | O | `main.js:384` | `show-in-folder` her yolu kabul ediyor. | Veri klasörleriyle sınırla | S |
| D10 | Düşük | D | `fk/fatura_kontrol/luca/otomasyon.py:1321` | Hata ekran görüntüleri (VKN, unvan, fatura) maskesiz JPG olarak firma klasöründe kalıyor. | İş sonunda sil ya da yalnız tanılama modunda al | S |
| D11 | Düşük | D | `fk/fatura_kontrol/ayarlar.py:69-73` | Windows dışında Luca parolası yalnız base64 (Windows'ta DPAPI doğru). | Windows dışında saklama | S |
| D12 | Düşük | O | `main.js:398, 547, 563` | `%TEMP%\MuhaWin-pdf`, `-faturalar`, `-wa` temizlenmiyor; fatura ve fiş görüntüleri kalıyor. | Çıkışta temizle | S |
| D13 | Düşük | O | `node_modules/builder-util-runtime` (electron-updater 6.3.9) | Yönlendirmede `Authorization` sızıntısı (npm audit yüksek); herkese açık depo ve belirteçsiz kullanımda etkisiz. | electron-updater güncelle | S |
| D14 | Düşük | O | `fk/requirements.txt` | Sürümler yalnız alt sınırlı (`lxml>=5.0` vb.); eski lxml/libxml2 XXE'de farklı davranabilir. | Sürümleri sabitle | S |
| D15 | Düşük | D | `fk/fatura_kontrol/web/app.py:46-47` | `FK_ANAHTAR` yoksa (MuhaWin dışında bağımsız çalıştırma) kimlik denetimi tamamen kapalı. | Anahtar yoksa rastgele üret | S |
| D16 | Düşük | O | `luca.js:919-921` | Luca istek kaydı (kullanıcı başlatınca) fatura ve muavin yanıt gövdelerini düz metin yazıyor; parolalar maskeli. | Süre sonunda silme / uyarı | S |

### Doğru yapılanlar
- **Electron pencereleri:** Bütün pencerelerde `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`. `webviewTag`, `webSecurity:false`, `allowRunningInsecureContent` hiçbir yerde yok. Açılan alt pencerelere preload geçmiyor (yerel Electron 31 denemesi).
- **IPC dosya yolları:** ÖKC dosya işlemlerinde `path.resolve` + `startsWith`, datastore'da `safeId` var.
- **Python yan süreci:** Yalnız `127.0.0.1`'e bağlanıyor. Her açılışta rastgele 24 baytlık anahtar üretiliyor ve `/api/saglik` dışındaki her uçta denetleniyor. CORS yok; anahtarsız istekler 403. Path traversal denemeleri reddedildi. `shell=True`, `eval`, `pickle` yok. pip-audit temiz. XXE ve billion laughs mevcut lxml sürümünde engelli.
- **Gizli bilgiler:** Luca parolası Windows'ta DPAPI ile şifreli. Çerezler yalnız bellekte; alt sürece `0600` izinli geçici dosyayla verilip siliniyor. Loglarda parola yok.
- **Supabase:**
  - 15 tablonun hepsinde RLS açık, doğrudan erişim kapalı.
  - 26 `admin_*` RPC'nin hepsi sunucu tarafında `_chk()` çağırıyor.
  - SECURITY DEFINER fonksiyonlarda `search_path` sabit.
  - Lisans ve davet kodları yalnız SHA-256 özeti olarak saklanıyor; PIN bcrypt ile.
- **Anahtarlar:** Depoda ve git geçmişinde yalnız `anon` anahtarı var (`eyJh…`, `cloud.js:10`, `mobil-yonetim/index.html:110`). `service_role` yok.
- **Güncelleme:** Güncelleme adresi sabit; Görev 03 ile kullanıcı onayı olmadan indirme yok.

## Önerilen düzeltme görevleri
Kartlar birbirinden bağımsız. Hangi kartın Görev 01 (menü düzeni) ile sıraya girmesi gerektiği her satırda belirtilmiştir.

| Kart | Kapsam | Dokunulacak dosyalar | Bulgular | İş |
|---|---|---|---|---|
| **G-A Fatura görüntüleme güvenliği** (öncelik 1) | XSLT erişim kısıtı, pencerede JS kapalı, CSP başlığı | `fk/fatura_kontrol/goruntu.py`, `fk/fatura_kontrol/web/app.py`, `main.js` (yalnız `fk-fatura-pdf`), yeni test `fk/tests/test_goruntu_guvenlik.py` | K1 | S |
| **G-B PDF okuyucu** (öncelik 1) | `isEvalSupported:false`, sonra pdf.js yükseltmesi | `renderer/index.html` (3 satır), `renderer/vendor/pdf*.js`. **Görev 01 ile aynı dosya; sıralı yürür** | Y1 | S |
| **G-C WhatsApp sunucu** (öncelik 1) | Numara bağlama, webhook HMAC, boş verify token, `anon` yetkileri | `sunucu/supabase-whatsapp.sql`, `sunucu/edge/whatsapp-webhook/index.ts`, `sunucu/supabase-yonetim.sql` (yalnız revoke) | Y2, Y3, D1, D4 | S |
| **G-D Electron gezinme ve IPC** | `will-navigate`, `open-mail` beyaz listesi, `show-in-folder` sınırı, temp temizliği | `main.js` | O1, O3, D9, D12 | S |
| **G-E Lisans sıkılaştırma** | Tek deneme, imzalı çevrimdışı durum, cihaz kimliği, RPC deneme sınırı, hata mesajı, uzunluk sınırı | `sunucu/supabase-ofis.sql`, `sunucu/supabase-yonetim.sql`, `cloud.js` | O4, O5, O6, D2, D3, D8 (O7 kullanıcı kararıyla) | M |
| **G-F Belge girdisi sınırları** | ZIP derinlik/boyut, yükleme sınırı | `fk/fatura_kontrol/fatura_okuyucu.py`, `fk/fatura_kontrol/web/app.py` | O8 | M |
| **G-G Bağımlılık yükseltme** | Electron, SheetJS 0.20.x, electron-updater, `requirements.txt` sabitleme | `package.json`, `package-lock.json`, `renderer/vendor/xlsx.full.min.js`, `luca.js` (gerekirse), `fk/requirements.txt` | O10, O11, D13, D14 | L |
| **G-H Kod imzalama** | Sertifika, `publisherName`, sürüm deposu koruması | `package.json` (`win`), GitHub ayarları. **Kullanıcı kararı ve maliyet** | O9 | L |
| **G-I Yerel veri ve oturum hijyeni** | Hata görüntüleri, Windows dışı parola, beni hatırla, yönetim belirteci, PIN, bağımsız mod anahtarı, Luca kaydı | `fk/fatura_kontrol/luca/otomasyon.py`, `fk/fatura_kontrol/ayarlar.py`, `fk/fatura_kontrol/web/app.py`, `main.js`, `mobil-yonetim/uygulama.js`, `cloud.js`, `luca.js` | D5, D6, D7, D10, D11, D15, D16 | M |
| **G-J CSP sıkılaştırma** | Satır içi script'leri dosyaya taşıma, nonce CSP | `renderer/index.html`, `renderer/splash.html`. **Görev 01 birleştikten sonra** | O2 | M |

## Denetlenmeyenler
- **`supabase-kurulum.sql` depoda yok.** `profiles`, `licenses`, `license_codes`, `devices`, `settings`, `admins` tablolarının asıl RLS ve yetkileri, `save_registration` ve `_is_admin`'in ilk tanımı görülemedi. `settings` okunabiliyorsa PIN'in bcrypt özeti çevrimdışı kırılabilir. Canlı projede ilk bakılacak yer burası.
- **Canlı Supabase ayarları** (e-posta doğrulama, Auth hız sınırları, JWT süreleri, `storage.objects` kuralları, yüklü SQL sürümü, edge secrets): ağa çıkılmadı.
- **Edge fonksiyonları (Deno)** çalıştırılmadı; Y3 ve D4 statik incelemeye dayanıyor.
- **Gerçek Luca, GİB akışları ve Windows'a özgü davranışlar** (DPAPI, NSIS kurulum, imza doğrulama) yalnız kodla incelendi. Derleme yapılmadı.
- **`renderer/index.html` (6.5 bin satır):** XSS taraması `innerHTML` örneklemesiyle yapıldı, tam satır satır değil.
- **Y1** (PDF.js) sürüm eşlemesiyle belirlendi; kötü niyetli PDF ile deneme yapılmadı.

## Kullanılan skill'ler ve komutlar
- **`claude-security`** eklentisi kurulu ama çalıştırılmadı: çok ajanlı tam tarama, kullanıcı onayı gerektiren yüksek token maliyeti taşıyor. İstenirse G-A/G-C düzeltmelerinden sonra çalıştırılabilir. **`security-guidance`** kurulu değil.
- Kartın listesi elle uygulandı. Üç paralel alt inceleme yapıldı: Electron, Python yan süreci, Supabase ve web paneli. K1 ayrıca bu oturumda `goruntu_html()` üzerinden yeniden denendi.
- **Komutlar:**
  - `npm audit --omit=dev`: 1 kritik, 6 yüksek. `tar`, `node-pre-gyp`, `canvas` isteğe bağlı ve kurulu değil. Gerçek etkisi olanlar pdfjs-dist, xlsx ve builder-util-runtime.
  - `pip-audit -r fk/requirements.txt`: bilinen açık yok.
- **Yerel denemeler:**
  - FastAPI TestClient: kimlik, CORS, path traversal.
  - lxml: XXE, billion laughs, XSLT.
  - Electron 31: alt pencere preload kalıtımı.
  - Yerel PostgreSQL 16 (Supabase rol ve `auth.uid()` taklitleriyle): `sunucu/*.sql` RPC denemeleri.
  - Node: çevrimdışı önbellek sahteciliği.
- Deneme betikleri depoya eklenmedi.
