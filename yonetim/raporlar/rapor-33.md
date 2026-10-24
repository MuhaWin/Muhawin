# Rapor 33 – Üst menü hizası ve sıralama

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Taban: `main` (07b712f). Ekran görüntüleri `yonetim/raporlar/rapor-33/` klasöründe: `once-*` main'deki hâl, `sonra-*` bu değişiklikten sonra.

## İstekler ve yapılanlar
| # | İstek | Kök neden | Yapılan |
|---|---|---|---|
| 1 | Ana ekrandaki modül sırası, Modüller sayfasındaki sırayla aynı olsun | Üst sekme satırı sabit bir listeyle çiziliyordu (Banka, Muhasebe, Belgeden Fiş). | Sekme sırası modül seçim ekranının kullandığı modül listesinden alınıyor: **Muhasebe · Banka · Belgeden Fiş** (sonra varsa Ofisinize Özel, Yönetim). |
| 2 | İlk açılışta menülerde yazılar üst üste biniyor | Muhasebe paneli sabit konumlu ve yeri yalnız açılırken ya da pencere boyu değişince hesaplanıyordu. Sonradan **üst bölümün boyu değişirse** panel eski yerinde kalıyor, alt menü modül sekmelerinin üstüne biniyordu. Boyu değiştirenler: yazı tipinin geç yüklenmesi, Luca düğmesinin "Luca'ya giriş" → "● Luca bağlı" olması, şeridin iki satıra inmesi, pencerenin ekrana sığdırılması. Hata yeniden üretildi: `once-binme.png` ("Banka / Toplu Kontrol / Belgeden Fiş" üst üste). | Üst bölüm, modül sekmeleri ve Banka alt sekmeleri `ResizeObserver` (border-box) ile izleniyor; yazı tipi yüklenince ve pencere boyu değişince de bakılıyor. Değişince `mw-hiza` olayı Muhasebe panelini ve Mizan / fatura kaydı panellerini yeniden yerleştiriyor (`sonra-binme.png`). |
| 3 | Muhasebe alt menüsü Banka alt menüsüyle aynı hiza, genişlik ve boyda olsun; "Toplu Kontrol'e dön" satırı da aynı hizada | Banka alt sekmeleri sayfa sütununun içinde (geniş ekranda ortalı). Muhasebe paneli ise pencerenin sol kenarından başlıyordu. 1920 px'te Toplu Kontrol x=16, Banka Ekstreleri x=249 (`once-1920-muhasebe` / `once-1920-banka`). | Ayrıntılar aşağıda. Ölçüm (1440 ve 1920 px): Banka Ekstreleri ve Toplu Kontrol aynı x, aynı y (186), aynı yükseklik (45). |
| 4 | Mizan / Muavin / Hesap Planı açılınca alt menü kaybolmasın | Panel modül sekmelerinin hemen altından başlayıp alt menünün üstünü örtüyordu. | Panel artık **en alttaki görünür menü satırının** altından başlıyor: Muhasebe'de alt menü, Banka'da Banka / Kredi Kartı sekmeleri. Alt menü ve etkin öğe (ör. Toplu Kontrol) görünür kalıyor (`sonra-1440-mizan`, `sonra-1920-mizan`). Aynı kural "Faturaları Luca'ya kaydet" paneli için de geçerli. |
| 5 | Genel görsel tutarlılık (aynı hiza kuralı) | – | Ayrıntılar aşağıda. |

### 3 – Muhasebe hizası
- Muhasebe paneli, modül sekme satırının sütununa oturuyor (sol ve sağ kenar aynı).
- Alt menü (Toplu Kontrol … KDV Beyannamesi) Banka alt sekmeleriyle aynı yazı boyu (15 px), iç boşluk (10/18/9), alt çizgi ve dikey aralıkta (sekmelerin 12 px altında). Bant zemini kaldırıldı.
- Fatura Kontrol sayfaları (Toplu, Tek Firma, KDV) MuhaWin içinde sütun kenarına yaslanıyor; üst bant ve "← Toplu Kontrol'e dön" satırı da öyle (`tema.css`, yalnız `html.mw`).
- Fiş Girişi ve Fiş Listesi panelleri de sütuna yaslı.
- Sayfa içeriği (raporlar, tablolar) sütun genişliğinde, geniş kalıyor. Banka tarafına dokunulmadı.

### 5 – Tek hiza kuralı
Tüm modüllerde üst şerit, modül sekmeleri, alt menü ve sabit paneller aynı sol / sağ çizgide (`hizaKutu()`). Uygulandığı yerler:
- Muhasebe paneli
- Mizan / Muavin / Hesap Planı
- Faturaları Luca'ya kaydet
- Fiş Girişi ve Fiş Listesi

Banka, Belgeden Fiş, Ofisinize Özel ve Yönetim zaten sayfa sütununun içindeydi.

## Değişen dosyalar
- `renderer/app.js`:
  - `hizaKutu()` ve `mw-hiza` (ResizeObserver, `fonts.ready`, pencere boyu)
  - `FKUI.place` (sütuna oturma, Banka ile aynı aralık)
  - `UstPanel` (en alttaki menünün altından başlama, sütun)
  - `modSekmeCiz` (sıra)
- `renderer/style.css`: Görev 33 bölümü (alt menü boyu, bant zemini, panel iç boşlukları)
- `fk/fatura_kontrol/web/static/tema.css`: yalnız `html.mw` için 3 satır (sayfa kenarı, üst bant, "Toplu Kontrol'e dön" satırı)
- `test/e2e.js`: sıra denetimi güncellendi; 3 yeni denetim
- `yonetim/raporlar/rapor-33.md` ve `rapor-33/*.png` (15 görüntü)

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **292 ✓, 0 başarısız.**
- `node test/mobil.js`: **45/45.**
- Yeni ya da değişen e2e denetimleri:
  - modül sekmeleri modül seçim ekranıyla aynı sırada (Muhasebe · Banka · Belgeden Fiş)
  - **hiza ölçümü:** Banka Ekstreleri ve Toplu Kontrol'ün x / y / yüksekliği eşit (±1 px)
  - **üst üste binme:** üst bölüm 70 px büyüyüp küçülünce Muhasebe paneli her seferinde modül sekmelerinin altına yeniden yerleşiyor. Bu denetim düzeltmeden önce düştü; sorun böyle bulundu.
  - Muhasebe › Toplu Kontrol'deyken Mizan açılınca alt menü panelin üstünde kalıyor ve etkin öğenin üzerinde başka öğe yok

## Notlar
- Görev 34 (Yazılımcı, FK tarafı) ile çakışma riski düşük. `tema.css`'e yalnız `html.mw` ile başlayan üç satır eklendi; `index.html` ve `toplu.html` değişmedi.
- Dal: ortam yalnız `claude/affectionate-darwin-effcgp` dalına push izni veriyor; bu dal açık #61'in (G32) başı. Push yöntemi yöneticiyle konuşuldu (aşağıdaki PR açıklamasına bakın).
