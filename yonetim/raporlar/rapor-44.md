# Rapor 44 – Luca penceresinde "MuhaWin'e git" düğmesi

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Taban: `main` (Görev 43 sonrası). Derleme yok.

## Önceki durum
- **Düğme:** "↩ Muavine dön". Luca'nın içerik çerçevesinin (`frm3`) **sağ altına** sabitlenmişti (`luca.js` › `DON_JS`).
- **Basınca:**
  1. Luca penceresi **simge durumuna küçültülüyordu**.
  2. MuhaWin ana penceresi öne geliyordu.
  3. MuhaWin'de **Muavin ekranı açılıyordu** (`muavineDon` olayı → `MMUI.open('muavin')`).
- **İstenenden farkı:** Luca küçültülüyordu ve MuhaWin'de ekran değiştiriliyordu. Yeni davranışta ikisi de yok (aşağıda).

## Yeni durum
### Yer
- **Hangi çerçeve:** Düğme pencerenin en üstündeki çerçeveye konuyor. Bu, pencerenin sol üst köşesinden başlayan çerçevelerin en kısası; Luca'da logolu üst şerit. Çerçevesiz bir Luca sayfasında sayfanın kendisi kullanılıyor.
- **Yatay konum:** Sol üstteki Luca logosunun (ilk resim) sağından başlıyor. Luca'nın hiçbir öğesine (metin, resim, bağlantı, düğme, kutu) değmeyen ilk boş yere konuyor; öğelerle arasında en az 8 px boşluk kalıyor.
- **Dikey konum:** Şeridin ortasında.
- **Görünüm:** Eskisinden büyük ve belirgin: 32 px yükseklik, 14 px kalın yazı, MuhaWin turkuazı (#12B5A0). Yazısı **"MuhaWin'e git"**.

### Luca'yı engellememe
- **Tıklama:** Düğme Luca öğelerinin üstüne binmediği için onların tıklamasını kapatmıyor; testte Luca'nın "Çıkış" bağlantısı tıklanabiliyor.
- **Yeniden yerleşme:** Pencere boyu değişince ya da Luca şeride yeni bir öğe koyunca düğme yeniden yerleşiyor.
- **Şeritte yer yoksa:** Düğme şeritte gizleniyor ve Luca öğesinin üstüne binmiyor. Kaybolmasın diye eski yerine, içerik çerçevesinin sağ altına konuyor. Şeritte yer açılınca üste dönüyor, sağ alttaki kaldırılıyor.
- **Sayfa değişince:** Luca bir çerçeveyi yeniler ya da sayfa değiştirirse ana süreç düğmeyi yeniden koyuyor (`did-frame-finish-load`). Aynı anda tek düğme oluyor; başka çerçevede kalan eski düğme siliniyor.
- **Dokunulmayanlar:** Luca'nın işlerine dokunulmadı: iş kilidi, `fisGoster`, fiş kesme, sayfa yönetimi.

### Davranış
- **Basınca:** MuhaWin ana penceresi küçültülmüşse geri açılıyor, öne geliyor ve odak alıyor (`restore`, `show`, `moveTop`, `focus`).
- **Luca penceresi:** Olduğu gibi açık kalıyor; küçültülmüyor, kapatılmıyor.
- **MuhaWin'deki ekran:** Değiştirilmiyor; kullanıcı hangi ekrandaysa oraya dönüyor. Muavin ekranını açan eski olay kaldırıldı.
  - Muavine gitmek istenirse MuhaWin'deki "Mizan / Muavin / Hesap Planı" düğmesi kullanılır. "Muavin de açılsın" denirse tek satırla geri eklenir.

## Testler (Linux; derleme yok)
- **`test/luca/muhawine-git.js`** (yeni; eski `muavine-don.js` yerine). Sahte Luca ana ekranında Chromium ile sınıyor (`test/luca/sahte-ust-serit.js`: üstte logolu şerit `frm4`, solda menü, sağda içerik). Denetimler:
  - düğme `frm4` şeridinde; yazısı "MuhaWin'e git"
  - 980 / 1024 / 1366 / 1920 px genişliklerde logonun sağında ve şeridin içinde. Görev 41 ölçüm aracıyla (`test/cakisma.js`) Luca öğeleriyle çakışma yok.
  - yalnız bir düğme var; yeniden eklemede ikincisi oluşmuyor
  - şeride yeni öğe gelince boş yere kayıyor
  - şerit dolunca sağ alta iniyor; yer açılınca üste dönüyor
  - Luca'nın "Çıkış" bağlantısı tıklanabiliyor
  - basınca ana sürece işaret gidiyor (konsol iletisi ve başlık)
  - çerçevesiz sayfada da üstte; frameset'e eklenmiyor
- **e2e** (gerçek uygulama, Electron):
  - gerçek `luca.js` ile sahte Luca penceresi açılıyor; düğme üst şeritte, logonun sağında
  - şerit yenilenip içerik sayfası değişince düğme yerinde ve tek
  - Luca penceresi odaktayken düğmeye basılınca **MuhaWin ana penceresi odak alıyor**; Luca penceresi açık ve küçültülmemiş
  - test için `main.js`'te yalnız paketlenmemiş, test sunuculu çalıştırmada `luca` modülü testlere açıldı (`global.__mwTest`); paketlenmiş programda bu kod çalışmıyor
- Sonuçlar:
  - `xvfb-run -a node test/e2e.js`: **E2E_SONUC**
  - `test/luca/*.js`: hepsi geçti
  - `node test/mobil.js`: **45/45.**

## Riskler
- **Gerçek Luca'da sınanmadı.** Testler sahte bir Luca sayfasıyla yapıldı. Gerçek Luca'nın üst şeridinin yapısı farklıysa:
  - Çerçeve seçimi (sol üst köşeden başlayan en kısa çerçeve) ve logo bulma (sol üstteki ilk resim) genel yazıldı.
  - En kötü durumda düğme eski yerine, sağ alta iner; görünmez olmaz.
  - Windows'ta gerçek Luca'yla bir kez elle denenmeli.
- **Odak:** Windows bazen başka uygulamanın penceresinin odak çalmasını engeller. Burada iki pencere de MuhaWin'in olduğu için sorun beklenmez; e2e'de (Linux) ana pencere odak aldı.

## Değişen dosyalar
- `luca.js`: `GIT_JS` / `KONUM_JS` (yer bulma, yedek yer), `donDugmesiEkle` (çerçeve seçimi), `muhawineGit` (ana pencere öne / odak; Luca açık kalır)
- `renderer/app.js`: eski `muavineDon` olayı (Muavin ekranını açan satır) kaldırıldı
- `main.js`: yalnız test çalıştırmasında `global.__mwTest`
- `test/luca/muhawine-git.js` (yeni), `test/luca/sahte-ust-serit.js` (yeni), `test/luca/muavine-don.js` (silindi), `test/e2e.js`
- `yonetim/raporlar/rapor-44.md`
