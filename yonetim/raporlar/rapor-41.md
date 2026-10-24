# Rapor 41 – Farklı ekran boyu ve ölçeklemede düzen

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Taban: `main` (Görev 40 sonrası). Ekran görüntüleri `yonetim/raporlar/rapor-41/` klasöründe: `once-*` main'deki hâl, `sonra-*` bu değişiklikten sonra.

## 1. "Açılış sayfası iç içe geçmiş"

### Yeniden üretme
- Yeni ölçüm aracı (`test/ekran.js`, aşağıda) ekranları aşağıdaki boylarda açıp ölçtü:
  - %100: 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440 ve en küçük pencere (980×640)
  - 1920×1080 @%125 ve @%150; 3840×2160 @%150 ve @%200
  - her ölçekte büyütülmüş ve tam ekran pencere
- Windows ölçeklemesi Electron'un `--force-device-scale-factor` seçeneğiyle taklit edildi. Pencere içi boy CSS pikseli, yani fiziksel çözünürlük ÷ ölçek.
- Main'de 198 ölçümün 19'unda sorun çıktı:
  - 13'ü **giriş ekranında** (programın ilk açılan sayfası), 18 boyun 13'ünde
  - 6'sı Muhasebe çerçevesinde; ölçüm düzeltilince yanlış alarm çıktı (aşağıda)
- Giriş ekranı 1280×720'de düzgün, 1920×1080 ve üstünde ya da kısa pencerede bozuk. Kullanıcının "kendi bilgisayarımda düzgün, başkasında iç içe" demesine uyuyor.

| Ekran | Önce | Sonra |
|---|---|---|
| 3840×2160 @%150 | `once-giris-3840x2160-150.png`: logo, başlık ve liste sağdan kesik; "© 2026 · Sürüm" satırı listenin üstünde | `sonra-giris-3840x2160-150.png` |
| 1920×1080 | `once-giris-1920x1080.png`: başlık kesik; "Yakında…" satırı "© 2026 · Sürüm" satırının üstüne biniyor | `sonra-giris-1920x1080.png` |
| 980×640 | `once-giris-980x640.png`: geliştirici / güncelleme satırları formun notunun üstüne biniyor | `sonra-giris-980x640.png` |

### Kök nedenler
1. **Logo ve başlık görselin içinde, görsel kırpılıyordu.**
   - Sol paneldeki MuhaWin logosu ve "Rutin işleri bize bırakın…" başlığı 560×720 boyunda bir resmin parçası.
   - Panel en çok 560 px genişlikte, ama pencere boyunca uzuyor. Resim `background-size:cover` ile bu yüksekliğe büyütülüyordu.
   - 1080 px yükseklikte resim 1,5 kat, 840 px genişliğe çıkıyor ve sağdan 280 px'i kesiliyordu.
2. **Özellik listesi daralıp sürüm satırının üstüne taşıyordu.**
   - Liste resimle aynı oranda büyütülüyordu (`max(genişlik/560, yükseklik/720)`), sonra panele sığsın diye daraltılıyordu.
   - Daralan liste satırlara bölünüp uzuyordu. Sürüm satırı ise sabit bir yerde (`top:670px`) durduğu için liste onun üstüne biniyordu.
3. **Sağ alttaki satırlar sabit konumdaydı.**
   - "Program SMMM … geliştirilmiştir." ve "Güncellemeleri Denetle" satırları pencerenin sağ altına sabitlenmişti (`position:fixed`).
   - Pencere kısa olunca formun alt notu bu satırların altında kalıyordu.

### Düzeltme (`renderer/style.css`, `renderer/app.js` › `authGate`)
- **Tasarım kutusu kırpılmıyor.** Resim artık 560×720 tasarım kutusunun kendi arka planı.
  - Kutu panele sığacak kadar ölçekleniyor (`min(genişlik/560, yükseklik/720)`) ve ortalanıyor.
  - Logo, başlık ve liste her boyda bütün ve birbirine göre aynı yerde kalıyor. Listeyi daraltan eski kod kaldırıldı.
- **Panel genişliği pencere yüksekliğiyle orantılı:** `min(100vh × 560/720, 50vw)`.
  - Örnekler: 1080 px yükseklikte 840 px, 720 px'te 560 px.
  - Çok dar ya da uzun pencerede boşta kalan şerit, görselin kenar renkleriyle (lacivert geçiş) doluyor.
- **Sürüm satırı** kutunun altına yaslandı (`bottom`); listeyle arasında hep boşluk var.
- **Sağ alttaki iki satır normal düzende.** Sabit konum kaldırıldı; satırlar formun altındaki ayrı ızgara satırlarında.
  - Kısa pencerede form ve satırlar alt alta diziliyor, sayfa kaydırılıyor.
- 900 px'ten dar pencerede panel eskisi gibi gizleniyor; form ve satırlar tek sütun.

## 2. "Kod tanımları ▾" (Faturaları Luca'ya kaydet)
- Görev 36'nın "Alış kod tanımları" ve "Satış kod tanımları" düğmeleri tek **Kod tanımları ▾** menüsünde toplandı. Menü: Alış kod tanımları, Satış kod tanımları.
- **"Doldurma" da menüde.** Görev 36'nın "Doldurma" seçimi (Kural → geçmiş → varsayılan / Kural → kod tablosuna göre) de aynı panele alındı.
  - **Neden:** İki düğme tek menü olunca bile seçim kutusu 1440 px'te üçüncü satıra düşüyordu (`once-luca-kaydet-1440.png`).
  - Seçim aynı kutu (`#fkkKaynak`) ve eskisi gibi firmaya kaydediliyor; geçerli seçim düğmenin ipucunda yazıyor.
  - **Yöneticiye not:** Yalnız iki düğmeyi toplamak istenen sonucu vermediği için bunu da ekledim. İstenmezse Doldurma araç çubuğuna geri alınabilir; o zaman 1440 px'te üçüncü satır geri gelir.
- **Davranış aynı:** Alış / Satış tıklanınca aynı kod tanımı penceresi açılıyor (aynı `kodTanim('ALIS'|'SATIS')`).
- **Menü kullanımı:** Oklarla gezilir. Esc ya da dışarı tıklama menüyü kapatır; Faturaları Luca'ya kaydet ekranı açık kalır. Menü düğmenin sağ kenarına hizalı, pencereden taşmıyor.
- **Sonuç:** 1440 px'te araç çubuğu iki satır: süzgeçler ve işlemler (`sonra-luca-kaydet-1440.png`). Önce üç satırdı.

## 3. Ölçüm aracı ve e2e
- **`test/cakisma.js`** sayfada ya da çerçevede çalışır ve görünür her öğeyi ölçer: düğme, bağlantı, giriş kutusu, resim ve doğrudan metni olan her öğe. Üç tür sorun yakalar:
  - **çakışma:** DOM'da biri ötekini içermeyen iki öğe 2 px'ten fazla kesişirse. Metinde öğenin kutusu değil, metnin kendisi ölçülür (Range); taşan metin de yakalanır. Başka bir katmanın tamamen örttüğü öğe sayılmaz (`elementFromPoint`).
  - **kesik metin:** Metin, kaydırılamayan (`overflow:hidden`) bir kutunun kenarında yarım kalırsa. Kendi kaydırma çubuğu olan kutuda aşağıda kalan metin ve "…" ile kısaltılan metin sayılmaz.
  - **yatay taşma:** Sayfa yatay kaydırılabiliyorsa (`scrollWidth > clientWidth`) ya da bir öğe pencerenin dışına çıkıyorsa.
  - Kasıtlı üst üste binme için öğeye `data-ust-ok` konur; şu an hiçbir yerde gerekmedi.
- **`test/ekran.js`**: matris. Ekranlar:
  - giriş ve modül seçimi (açılış)
  - Ayarlar, Banka, Mizan / Muavin / Hesap Planı, Belgeden Fiş
  - Muhasebe: Toplu, Tek Firma, KDV beyannamesi (çerçevenin içi de ölçülüyor)
  - Faturaları Luca'ya kaydet, lisans ekranı
  - Kullanım: `xvfb-run -a -s "-screen 0 3840x2160x24" node test/ekran.js`. `EKRAN_OLCEK` ve `EKRAN_EKRAN` ile daraltılabilir; `EKRAN_FOTO=1` her ölçümün görüntüsünü alır.
- **e2e** matrisi açılış (giriş, modül seçimi) ve ana ekranlar (Banka, Muhasebe Toplu ve Tek Firma, Faturaları Luca'ya kaydet) için çalıştırır.
  - Her ekran için bir denetim var, ayrıca dört ölçeklemenin de ölçüldüğü denetleniyor.
  - Büyütülmüş ve tam ekran ölçümü için kendi 4K sanal ekranını açar (`xvfb-run`). xvfb-run yoksa bu iki ölçüm atlanır.
- **Kod tanımları için e2e denetimleri:**
  - menü (Alış / Satış ve Doldurma), oklar, Esc, dışarı tıklama
  - 1440 px'te araç çubuğu iki satır
  - Görev 36 denetimleri menü üzerinden

### Sonuç (bu dal)
- `test/ekran.js` tam matris: giriş, modül seçimi, Ayarlar, Banka, Mizan, Belgeden Fiş ve Faturaları Luca'ya kaydet **temiz**.
- Muhasebe çerçevesi (Toplu, Tek Firma, KDV) ölçümün son hâliyle yeniden ölçüldü: **54 ölçümün hepsi temiz.**
  - İlk ölçümdeki 6 "kesik metin" bulgusu yanlış alarmdı. Muhasebe sayfalarının sol paneli kendi kaydırma çubuğuyla kayıyor; aşağıda kalan metin kaydırınca görünüyor.
  - Ölçüm bu durumu ayıracak biçimde düzeltildi. Main'deki aynı bulgular da aynı yanlış alarm.

## Değişen dosyalar
- `renderer/style.css`:
  - giriş ekranı (panel genişliği, tasarım kutusu, alt satırlar)
  - `.dmenu` / `.dmenulist` açılır menü
- `renderer/app.js`:
  - `authGate` › `yerlestir` (sığdırma)
  - Faturaları Luca'ya kaydet araç çubuğu (Kod tanımları ▾ menüsü)
  - menü olayları (aç / kapa, oklar, Esc)
- `test/cakisma.js` (yeni), `test/ekran.js` (yeni), `test/e2e.js`
- `yonetim/raporlar/rapor-41.md`, `rapor-41/*.png` (8 görüntü)

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **E2E_SONUC**
- `node test/mobil.js`: **45/45.**
- `test/ekran.js` sonuçları yukarıda.

## Notlar
- Sınama Linux'ta, Inter yazı tipiyle yapıldı. Windows'ta yazı tipi yedeği (Segoe UI) biraz farklı genişlikte. Giriş ekranındaki tasarım kutusu artık bütün olarak ölçeklendiği için yazı genişliği farkı satırları birbirine bindirmez.
- Görev 40'ın (muavin okuyucu) dosyalarına dokunulmadı.
