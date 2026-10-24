# Rapor 49 – Detay denetim düzeltmeleri

**Oturum:** Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · **Taban:** `main` `ba4610f` (#88, #89, #90 dahil) · **Dal:** `claude/beautiful-bohr-c7x9ij`

- Derleme yapılmadı.
- Raporlar (denetim / yönetici) değişmedi.
- Testlerde sahte veri kullanıldı.

## 1. "Fatura muavinde kayıtlı değil" (fiş getirilemiyor)

### Bulgu
Sahte veriyle (Mikro, Luca, Elektra okuyucuları) **yeniden üretemedim**. Bu verilerde KDV / matrah listelerinin eşleştirdiği her fatura gider / gelir kontrolünde de kayıtlı görünüyor. İkisi aynı eşleştirmeyi kullanıyor: `esle` sonucundaki satırlar.

Ekrandaki "Fatura muavinde kayıtlı değil." yazısı iki ayrı durumda çıkıyordu:
- **(a)** Fatura belge no ile hiç eşleşmemiş. Bu durumda KDV listesinde de "Muavinde yok" görünür.
- **(b)** Fatura eşleşmiş ama muavin satırlarında **fiş no yok**. Kayıt bulunmuş, yalnız fiş açılamıyordu.

Kullanıcının durumu büyük olasılıkla bunlardan biri.

### Yapılanlar (`detay.py`)
1. **Yedek eşleştirme.** Belge no ile bulunamayan fatura için sırayla:
   - **Numara farklı yazılmışsa:** ayraçlı ya da küçük harfli yazım (`ABC-2026-000000123`) ya da seri ön eki olmadan (`2026000000123`). Aynı ay olmalı ve fişin karşı tarafı tutmalı.
   - **Numara hiç yazılmamışsa:** aynı ayda tek bir fiş aranır. Bu fişte karşı taraf (ünvan / VKN) tutmalı ve cari / ödeme hesabına faturanın ödenecek tutarı yazılmış olmalı (alışta alacak, satışta borç).
   - Başka faturaya ait satırlar alınmaz. Birden çok aday varsa eşleştirme yapılmaz.
   - Nasıl bulunduğu ekranda yazılır (`eslesme`).
2. **Fiş no'suz muavin.** Faturanın satırları ile aynı gün ve aynı açıklamalı satırlardan kayıt (hesap, cari) çıkarılır. Kontrol ekranında "Muavinde fiş numarası yok; faturaya ait muavin satırları" tablosu gösterilir.
3. **Toplu fiş.** Fişte başka faturalar da varsa, belge no'suz gider / gelir satırı iki durumda bu faturaya sayılır:
   - karşı tarafı yazıyorsa,
   - ya da tutarı faturanın matrahıysa.
4. Gerçekten bulunamazsa neden "Fatura muavinde bulunamadı (belge no, cari / tutar / tarih ile)" olur.

### Kullanıcıdan istenecek en küçük örnek (sorun sürerse)
"Kayıtlı değil" görünen **bir** fatura için:
- Faturanın numarası, tarihi ve tutarı.
- Muhasebe programı (Luca / Mikro / Elektra).
- O faturanın kaydedildiği fişin muavindeki satırları (ekran görüntüsü yeter; ünvan / VKN karartılabilir). Özellikle şu sütunlar gerekli: Tarih, Fiş No, Evrak No, Açıklama, Hesap, Borç, Alacak.
- Aynı faturanın KDV kontrolü listesindeki durumu ve açıklaması.

## 2. Yapay zekâ önerisi sistemden kaldırıldı (bayrakla kapalı, kod duruyor)
Bayraklar:
- `yz.js` › `YZ_ETKIN = false`
- `fk/fatura_kontrol/yz.py` › `ETKIN = False`
- `denetim.html` › `YZ_ETKIN = false`

Kapalıyken:
- Ekranda yapay zekâ rozeti, bölümü ve "Bekleyenleri yapay zekâya sor" yok. Programa `yz*` mesajı gitmez.
- Ayarlar'daki "Yapay zekâ ile karşılaştırma" bölümü gizli: `durum().etkin = false`.
- `degerlendir` istemciyi kurmadan reddeder. **SDK çağrısı hiçbir yoldan tetiklenmez.**
- `/api/denetim/yz/*` uçları 404 döner ve detay listesine öneri eklenmez.

Açmak için üç bayrak `true` yapılır.

Testler:
- Kapalı yol: `test/yz.js` (SDK kurulmadan reddedilir), `test_api_kapali`, `test_tarayicida_oneri_kapali` (programa hiç `yz` mesajı gitmiyor).
- Açık yol: testte bayrak açılarak korunur (`etkin: true`, `monkeypatch`).

## 3. Kısayollar
**A = Uygun, S = Uygun değil.** Düğme etiketlerinde, üst bilgide ve liste ipucunda yazıyor. Fatura görünümüne tıklandıktan sonra da çalışır: çerçevedeki tuş sayfaya aktarılır.

## 4. Fatura görünümü ekrana tam sığar
- **Sığdırma:** Fatura çerçevenin genişliğine ölçeklenir ve yatay kaydırma olmaz. Üstte **− / Sığdır / +** ve oran ("%58 · sığdırıldı") var. Pencere boyu değişince yeniden sığdırılır.
- **Çerçeve:** `sandbox="allow-same-origin"` oldu, yalnız genişliği ölçmek için. `allow-scripts` yok, faturadaki betik yine çalışmaz.
- **Düzen:**
  - Kontrol ekranında sütunlar `minmax(330px,42%) | 1fr` ve başlık satırı kayabiliyor.
  - Dar ekranda (≤1150 px) kısayol ipucu gizleniyor.
  - Kural penceresinde şart satırları hizalı.
- **Ölçüm:** Görev 41 aracıyla (`test/cakisma.js`) 1366×768, 1920×1080 ve 2560×1440 ekranlarda, her birinde %100 / %125 / %150 ölçekle denendi. Bakılan ekranlar Özet, Gider kontrolü, Kontrol kuralları, kontrol ekranı ve kural penceresi. Hiçbirinde **çakışma, taşma ya da kesik metin yok**. 860 px genişliğinde bir fatura şablonu her boyutta çerçeveye sığdı (en dar durum: %58).

## 5. "Sitede Aç" bandı
Muhasebe Denetimi ekranının üstünden kaldırıldı (`#mdSite`). Ofisinize Özel kartlarının altındaki bant (`#hubSite`) duruyor. `test/e2e.js` buna göre güncellendi.

## 6. Kontrol kuralı = "Kural yap" penceresi
Kontrol ekranındaki "Bu cari için kontrol kuralı ekle…" ve Kontrol kuralları › "+ Kural ekle" aynı pencereyi açar.

**Şartlar:**
- Türleri: ünvan içerir, VKN/TCKN eşittir, fatura içeriği (kalem) içerir, matrah aralığı (`1000-5000`, `1000-`, `-5000`), kayıt hesabı ile başlar.
- Faturadan dolar. Şart 1 VKN'dir (yoksa ünvan), Şart 2 kayıt hesabıdır. Tür değiştirilince değer faturadan gelir.
- "+ Şart ekle" ile yeni şart eklenir. Bütün şartlar birlikte tutmalı (VE).
- Bir şartın içinde `|` = ya da, `+` = hepsi geçmeli. Bu, programdaki `kuralTutar` ile aynı mantık; Python'da da aynısı yazıldı.

**Pencerenin diğer alanları:**
- Yön: alış / satış / her ikisi.
- **Sonuç:** "Uygun say" ya da "Uygun değil say". Kayıttaki Kaydet / Hiç kaydetme karşılığı.
- Açıklama.
- "N fatura bu şartlara uyuyor" sayacı.

**Kuralların uygulanması:**
- Öncelik: karar > kural > geçmiş > bekliyor. Çok şartlı kural önce denenir.
- Yalnız hesap şartı tutmayan kural: "Kural N 770 bekliyor; kayıt 760".

**Ortak bileşen kullanılamadı.** Kayıt penceresi programın kendi sayfasında (`renderer/app.js`), denetim ise Fatura Kontrol'ün sayfasında (masaüstü çerçevesi ve site). Düzen ve eşleştirme kuralları birebir kopyalandı.

**Eski kurallar geriye uyumlu:** `{vkn | unvan, hesap}` biçimi "VKN eşittir / ünvan içerir VE hesap ile başlar → uygun" olarak çalışıyor ve listede bu metinle görünüyor.

## 7. Esc / Kapat → geldiği liste
**Neden:** Kontrol ekranı `position:fixed`. Ortak `tema.js` açık pencereyi `offsetParent` ile arıyordu ve bu sabit konumlu öğede hep `null` döner. Bu yüzden Esc, MuhaWin'e "geri" olarak gidiyor ve Muhasebe Denetimi'nden çıkılıyordu.

**Düzeltmeler:**
- `denetim.html`'de Esc yakalanıyor. Açık pencere (kural penceresi ya da kontrol ekranı) kapanır, MuhaWin'e gitmez.
- Kontrol ekranından **geldiği listeye** dönülür: aynı bölüm, aynı süzgeç (Kontrol bekleyen) ve aynı kaydırma yeri. Kapat düğmesi de aynı.
- Kutudayken Esc önce yalnız kutudan çıkar (Görev 47).
- `tema.js` açık pencereyi artık `getClientRects` ile buluyor; diğer sayfalarda da sabit konumlu pencereler doğru sayılıyor.

## 8. Özet'ten bölüme geçince üst düğmeler
- **Panel boyu:** MuhaWin'de Muhasebe Denetimi paneli pencereye tam oturuyor (`MDENET.boyla`: üst bölümün boyuna göre; `mw-hiza` ve pencere boyu değişince). Sayfa kaymadığı için üstteki sekmeler hep görünür.
- **Belgeler kartı:** Denetim sonucu açıkken "2. Belgeler" kartı kapanıyor ("Yeni denetim / belgeleri göster" ile açılır). Böylece bölüm menüsü 1366×768'de de görünür. Önceden menü formun altında kalıyordu. Bölüm değişince seçili düğme sol sütunda görünür kılınıyor.
- **Konum satırı:** İçeriğin üstünde yapışkan bir satır var: "← Özet" ve bölümün adı. Kullanıcı nerede olduğunu görüyor ve geri dönebiliyor.

## Testler
- **Python:** 212 geçti. Kalan 16 hata ana dalda da aynı: Luca otomasyonu ve program testleri gerçek Chrome istiyor.
  - Yeni testler: yedek eşleştirme (numara farklı / numarasız), tutmayınca bulunmaması, fiş no'suz muavin, toplu fişte numarasız gider satırı, çok şartlı kural (`|`, `+`, matrah aralığı, uygun değil, karar önceliği), eski kural.
  - Tarayıcı testi: fatura sığdırma ve + / Sığdır, Esc ile listeye dönüş, kutuda Esc, A ile karar, kural penceresi (faturadan dolan şartlar, + Şart ekle, tutar aralığı, şart silme, Esc), Kontrol kuralları "+ Kural ekle".
  - Yapay zekâ kapalı: API ve tarayıcı.
- **Node:** `test/yz.js`, `test/site_uret.test.js` (10), `web/denetim/kopru.test.mjs` (9) geçti.
- **Site uçtan uca** (`web/denetim/site_e2e.py`): TAMAM. Kontrol ekranında sığdırma ve S ile karar.
- **Program uçtan uca** (`test/e2e.js`, Electron): bu ortamda çalıştırılmadı. Yöneticinin çalıştırması gerek: "Sitede aç" denetim ekranında olmamalı.
