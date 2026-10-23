# Rapor 17 – Arayüz: sabit üst şerit, yakında modüller, temalar, ESC

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (ortam başka bir dala push'a izin vermiyor). Dal, `main` (6c67f88) ile birleştirilip üzerine kuruldu. Push zorlamasız (normal) yapıldı.

## İstekler
| # | İstek | Durum |
|---|---|---|
| 1 | Üst şerit ve modül sekme satırı her ekranda aynı yerde ve aynı yükseklikte olsun, kayma olmasın | **Yapıldı.** Kaymanın iki nedeni bulundu ve giderildi. Ayrıntılar aşağıda. |
| 2 | "Yakında" modüller üst sekme satırında görünmesin | **Yapıldı.** Pasif modüller (Denetim, Geçici Vergi, Personel) sekme satırında yok. Modül seçim ekranında pasif kart olarak duruyorlar. |
| 3 | Temaları azalt | **Yapıldı: 10 temadan 6'ya.** Ayrıntılar aşağıda. |
| 4 | ESC her ekranda "geri" olsun | **Yapıldı.** Zincir: açık pencere/menü → kapanır; tam ekran panel (Mizan, fatura kaydı) → kapanır; alt ekran → bir üst ekran (Muhasebe alt sayfası → Toplu Kontrol, Çek/Senet ve Muhasebe Denetimi → Ofisinize Özel, Yönetim alt sekmesi → Pano); modül → modül seçimi. Yazı kutusu kuralı aşağıda. |

### Kaymanın nedenleri ve çözümler
1. **Kaydırma çubuğu.** Bazı ekranlarda (Muhasebe, Mizan paneli) sayfa kaydırma çubuğu kayboluyordu. Bu yüzden şerit ve sekmeler 15 px genişleyip yana kayıyordu. `html{scrollbar-gutter:stable}` eklendi.
2. **Modül adının uzunluğu.** Başlıktaki modül adı (ör. "Ofisinize Özel Çözümler") uzayınca geniş ekranda şerit satır değiştirebiliyordu. Başlık bloğuna sabit en küçük genişlik verildi.

Ölçüm (1400 ve 1920 px; Banka, Muhasebe, Belgeden Fiş ve Mizan paneli ekranları):
- `#modSekme`, `#lucaTopBtn`, `#ayarlarBtn` ve `#firmSel` her ekranda piksel olarak aynı konum ve boyutta.

Tam ekran paneller (Mizan / Muavin / Hesap Planı ve Faturaları Luca'ya kaydet):
- Artık üst şeridi örtmüyorlar; modül sekme satırının hemen altından başlıyorlar.
- Panel açılınca sayfa başa alınır, kapanınca kaydırma yeri geri gelir.
- Panel açıkken başka modül sekmesine basılırsa panel kapanır. Süren bir kayıt işlemi varsa geçiş yapılmaz ve "Önce süren işlemin bitmesini bekleyin" uyarısı çıkar.

Seçili sekmenin üzerine fare gelince vurgu kayboluyordu; bu düzeltildi.

### Temalar
- **Kalan 6 tema:** MuhaWin, Defter, Kırmızı, Kum, Grafit, Yüksek kontrast.
- **Kaldırılan 4 tema** ve kayıtlı seçimin otomatik geçtiği tema:

| Kaldırılan | Geçtiği tema | Neden |
|---|---|---|
| Lacivert | MuhaWin | lacivert vurgu, neredeyse aynı |
| Zümrüt | Defter | yeşil vurgu |
| Bordo | Kırmızı | kırmızı ağırlıklı |
| Gece | Grafit | iki koyu tema |

- Kaldırılan temaların CSS tanımları silindi.
- Fatura Kontrol çerçevesine giden tema eşlemesi kalan temalara göre sadeleştirildi.

### ESC – yazı kutusu kuralı
- Metin kutusunda yazarken ESC ekrandan çıkarmaz. İlk ESC yalnız kutudan çıkar, ikinci ESC geri götürür.
- Aynı kural Fatura Kontrol çerçevesinde de geçerli (`fk/.../static/tema.js`).
- Açılır listede (select) ESC yalnız listeyi kapatır.

## Değişen dosyalar
- `renderer/index.html`:
  - `SKINS` (tema listesi) ve eski tema eşlemesi
  - `fkTheme` eşlemesi
  - `UstPanel` (tam ekran panel yerleşimi)
  - `modSekmeCiz` (yakında modüller gizli)
  - sekme geçişinde panel kapatma
  - ESC yazı kutusu kuralı (`yaziKutusu`)
- `renderer/style.css`:
  - `scrollbar-gutter`
  - başlık bloğu genişliği
  - seçili sekme/hover düzeltmesi
  - kaldırılan tema tanımları
- `fk/fatura_kontrol/web/static/tema.js`: çerçeve içi ESC yazı kutusu kuralı (yalnız bu satırlar; `toplu.html`'e dokunulmadı)
- `test/e2e.js`
- `yonetim/raporlar/rapor-17.md`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **275 ✓, 0 başarısız.** Bu çalışmada ÖKC OCR adımı da geçti; önceki zaman aşımları, iki testin aynı anda çalışmasından kaynaklanan yükten olmalı.
- `node test/mobil.js`: **45/45.**
- Yeni ya da değişen e2e denetimleri:
  - modül sekmelerinde yalnız açık modüller var (Banka · Muhasebe · Belgeden Fiş); "Yakında" modüller sekme satırında yok
  - tema sayısı 6 ve tema kimlikleri
  - ESC: yazı kutusunda önce kutudan çıkış, ikinci ESC'de modül seçimine dönüş
  - ESC ile Mizan panelinin kapanması (Banka'da kalınır)
  - Mizan paneli üst şeridi örtmüyor
  - **Kayma denetimi:** sekme satırı, Luca düğmesi, Ayarlar ve firma seçimi Banka, Belgeden Fiş, Mizan paneli ve Muhasebe ekranlarında aynı konum ve boyutta
- `fk` pytest çalıştırılmadı. `tema.js`'deki değişiklik yalnız ESC dinleyicisinde, Python testleri bu dosyayı kullanmıyor.

## Riskler
- `scrollbar-gutter:stable` kaydırma çubuğu olmayan ekranlarda sağda 15 px boşluk bırakır. Bu bilerek yapıldı, her ekranda aynı genişliği sağlıyor.
- Tam ekran panel açılınca sayfa başa alınıp kapanınca eski yerine dönüyor. Panel açıkken sayfanın arkada yeniden çizilmesi kaydırma yerini değiştirebilir.
- Kaldırılan bir temayı seçmiş kullanıcı, ilk açılışta en yakın kalan temaya geçer ve bu seçim kaydedilir.

## Devir notu
- G17 tamam. Yazılımcı `index.html` işlerine (G18 düzeltmeleri, G21, G22) bu birleştikten sonra başlayabilir.
- Fatura Kontrol sayfalarındaki kendi sekme/üst bantları (`toplu.html`) bu görevde değişmedi.
