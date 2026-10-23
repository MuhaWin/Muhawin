# Ana Depo – Bağlam Özeti (23.10.2026, HEAD de8ff1e = 2.9.12)

Sahibi: ana depo oturumu. Diğer oturumlar okur, değiştirmez. Ayrıntılı sürüm geçmişi ve kullanıcı kararları: `claude/durum-ve-birlestirme-plani.md`.

## 1. Ana deponun yeri ve erişim
- Depo: ana oturumun bulut kabındaki `/home/claude/muhawin`, dal `master`, 75 commit. İlk commit 9508b02 (18.10.2026), son commit **de8ff1e "Sürüm 2.9.12"**. Çalışma ağacı temiz.
- Ana oturum **desktop-2ncmpij** (C:\) bilgisayarına bağlı. Kullanıcının çalıştığı **"mehmet"** bilgisayarına (D:\EkstreLuca\MuhaWin) erişimi yok. Bağlı bilgisayarda komut çalıştıramıyor (`device_bash` yok); yalnız dosya listeleme, alma ve yazma yapabiliyor.
- GitHub: bu oturumda **erişim yok**.
  - `gh api repos/McLk007/muhawin-surumler` → "GitHub access to this repository is not enabled for this session".
  - `gh api user` → "No linked GitHub account".
  - Release yüklemesi, depo seçili açılan yeni bir oturumdan ya da kullanıcı tarafından yapılmalı.
- Git geçmişi diğer oturumlara taşınamıyor. `git bundle` 182 MB tutuyor, çünkü eski bir commit'te (c21d41d) node_modules var; 5646f3d'de çıkarıldı.
  - **Devir yolu:** `git archive` kaynak zip'i (~4 MB) + işçide `git init`.
  - İşçi yamaları `git format-patch de8ff1e..HEAD` ile ana depoya geri alınabilir.
- **2.9.12 kaynak zip'i** (`MuhaWin-kaynak-2.9.12.zip`) bu oturumda sohbete gönderildi. Kullanıcı bunu D:\EkstreLuca\MuhaWin'e kaydetmeli; yönetici notuna göre diskte yalnız 2.9.10 var.

## 2. Mimari
- **Electron kabuk** (Node):
  - `main.js` (587 satır): pencere, IPC, güncelleme, yan süreç başlatma.
  - `preload.js`: `window.desktop` API'si.
  - `renderer/index.html` (6561 satır): tüm arayüz (Banka / ekstre, Fiş girişi, Fiş listesi, KDV, ÖKC, Özel, Yönetim, modül kapısı, tema, komut paleti Ctrl+K).
  - `renderer/style.css`: temalar `[data-skin]`, yonetim.js.
- **Luca:**
  - `luca.js` (943 satır): `persist:luca` oturumu, otomatik giriş, gizli giriş + doğrulama kodu kutusu, paket seçimi, durum yoklaması, "Luca'da Çalış", "Muavine dön", işletme listeleri, çerezlerin otomasyona paylaşılması.
  - Birim betikleri: `test/luca/*.js`.
- **Veri:**
  - `datastore.js`: Ekstre verisi (firmalar, kurallar, çıktı ayarı) `veri.json` + `mizan/` içinde. Bu bilgisayarda ya da **büronun ortak klasöründe** (`EkstreLuca-Veri`) tutulabilir; kilitle okuma ve yazma yapar.
  - `cloud.js`: Supabase (üyelik, lisans, deneme, ofis, yönetici). Ekstre, mizan, kural ve Luca bilgisi sunucuya **gönderilmez**.
- **Diğer Node dosyaları:** `kur.js` (TCMB kurları), `ocr_onisle.js` (ÖKC OCR ön işleme), `sidecar.js` (Python sürecini başlatır: `-m fatura_kontrol.web`, sabit port).
- **Python yan süreç** `fk/fatura_kontrol` (FastAPI):
  - `web/app.py`: tek firma API ve sayfaları. `web/toplu_api.py`: toplu kontrol, Luca oturumu, captcha relay.
  - Çekirdek: `eslestirme.py` (fatura ↔ muavin, kaydedilmeyecek kuralları), `fatura_okuyucu.py` (UBL XML), `muavin_okuyucu.py`, `mikro_muavin.py`, `isletme_*`, `kayit_aday.py`, `rapor.py`, `cikti.py`, `depo.py`.
  - Veri kökü: `FK_VERI` ortam değişkeni, yoksa `./veri`. Bu veri **kullanıcı bilgisayarında, paylaşılmıyor**.
  - Luca / GİB otomasyonu (Playwright): `luca/otomasyon.py`, `luca/toplu.py`, `luca/kayit.py`.
  - Sayfalar `web/static/`: `index.html` (tek firma), `toplu.html`, `denetim.html`, `isletme-fis.html`, `beyanname.html`, `tema.css`, `tema.js` (tablo sıralama ve filtre), `captcha.js`.
- **Sunucu:** `sunucu/*.sql` (Supabase modüller, ofis, yönetim, WhatsApp) ve `sunucu/edge/` (whatsapp-al, whatsapp-webhook). `mobil-yonetim/`: GitHub Pages yönetim paneli.
- **Testler:**
  - `fk/tests` (pytest 103, ~8 dk).
  - `test/e2e.js` (250, Electron + xvfb). "Logo fişleri" adımı ara sıra düşer, tekrarda geçer.
  - `test/mobil.js` (42), `test/luca/*.js`.

## 3. Değişmez kurallar
- **Derleme / paketleme / teslim yalnız kullanıcı "oluştur / derle / gönder" deyince.** Diğer isteklerde: yap → test et → commit et → bilgi ver.
- **Gizli dosyalar:** GIZLI-* dosyaları paylaşılmaz ve kaynak zip'e girmez. Müşteri örnek dosyaları commit edilmez.
- **Şifreler ve oturum:**
  - Luca şifresi yalnız yerelde, şifreli saklanır.
  - Claude şifre ve token yazmaz; GitHub, Luca ve Supabase girişlerini kullanıcı yapar.
  - Lisans kodlarının sunucuya yalnız SHA-256 özeti gider.
  - Luca çerezleri yalnız bellekte ya da 0600 izinli geçici dosyada tutulur, API'den dönmez.
  - Luca istek kaydedici parola alanlarını gizler ve çerez saklamaz.
- **Kullanıcıya bırakılan işler:**
  - Doğrulama kodunu (captcha) her zaman kullanıcı okuyup yazar.
  - Geri alınamaz işlemleri (Fiş Kes, gönder) kullanıcı yapar.
  - GİB beyanname gönderimi ve e-imza otomatikleştirilmez.
- **Modüller:** Oyun modülü geri eklenmez. Yönetim modülü yalnız bilgi@smmmantalya.com + PIN ile açılır.
- **Kullanıcı kararları (23.10.2026):**
  - Serbest meslek defteri, sorgu ve kontrolde işletme gibi işlenir ve menüde "Ser.Mes.Defteri" adıyla görünür.
  - e-SMM Satış yalnız serbest meslek defterli firmalarda sorgulanır; e-SMM Alış tüm firmalarda sorgulanır.
  - İşletme / serbest meslek fiş aktarımı pasiftir ("Çok yakında").

## 4. Derleme ve teslim
1. `package.json` sürümünü artır, OKUBENI'ye yenilikleri yaz (başlık ve KURULUM satırındaki sürüm dahil).
2. `npx electron-builder --win nsis --x64 --publish never` (~6 dk).
3. `split -b 27000000 -d -a 1` ile 6 parçaya böl.
4. BIRLESTIR.bat'ı bir önceki sürümünkinden `sed` ile üret (sürüm ve bayt boyutu değişir).
5. `latest.yml`, `.blockmap`, OKUBENI ve `git archive` ile kaynak zip'ini ekle.
6. SendUserFile ile gönder.

GitHub release'i `McLk007/muhawin-surumler` deposuna yapılır: etiket `v<sürüm>`, dosyalar exe + blockmap + latest.yml.

## 5. Açık riskler ve konular (yönetici için)
1. **`test/ornek/` commit'li** (18.10.2026'dan beri): `logo_musteri.xlsx`, `mizan_inka.xlsx`, `mizan_savor.xlsx`, `mikro_*.xls`, `okc_fis*.jpg`. Adlarından gerçek müşteri verisi olabilirler; e2e testleri bu dosyaları kullanıyor.
   - Kullanıcı doğrulamalı. Gerçekse sahte verilerle değiştirilmeli; kaynak zip'lerden de çıkmalı.
2. Gizli giriş, kod kutusu, SSO çalışma penceresi, "Muavine dön" ve çerez paylaşımı **gerçek Luca'da denenmedi**.
3. "Luca listelerini al" ve işletme fişinin Luca'ya doğrudan kaydı çalışmıyor; aktarım pasif.
4. **Kuralların bilgisayarlar arasında paylaşılmaması** (kullanıcının ana şikâyeti):
   - Ekstre kuralları için ortak klasör desteği zaten var (`datastore.js`).
   - Fatura Kontrol verileri (`FK_VERI`: kaydedilmeyecek kuralları, kararlar, firma ayarları) yalnız yerelde.
   - Önerilen yön: Supabase'te ofis bazlı ortak tablolar (her ofis yalnız kendi verisini görür). Faturalar yerelde kalır. Site: Cloudflare Pages + Supabase Auth. Kullanıcı kararı bekleniyor (Supabase+Cloudflare mı, Türkiye'de VPS mi). KVKK açısından yurt dışı aktarım konusu hukukçuya sorulmalı.
5. Görev 01 (menü düzeni) için taban de8ff1e doğru. İşçiye 2.9.12 zip'i gerekiyor (bkz. 1. bölüm).

## 6. Bekleyen
- GitHub erişimi ve v2.9.11 / v2.9.12 yayınları.
- Merkezi veri deposu kararı.
- Gerçek Luca geri bildirimi.
- Muhtasar örneği.
- Luca döviz ID'si, komisyoncu XML; ertelenen işler 19, 21, 22, 34.
