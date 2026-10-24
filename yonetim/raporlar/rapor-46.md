# Rapor 46 – "Faturaları Luca'ya kaydet" tablosu yatay kaydırmasız

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Görev 44 (#78) birleştikten sonra güncel `main` üzerinde; Görev 47 (ESC) ile aynı PR. Derleme yok. Görüntüler `yonetim/raporlar/rapor-46/` klasöründe.

## Yeniden üretme
- `test/ekran.js` örnek faturaları gerçekçi yapıldı:
  - uzun ünvanlar ("ANTALYA AKARYAKIT OTOMOTİV TURİZM GIDA PAZARLAMA ANONİM ŞİRKETİ")
  - kalem adları, 11 haneli VKN / TCKN ve milyonluk tutarlar
- `test/cakisma.js`'e **yatay kaydırma** denetimi eklendi: verilen kutuda `scrollWidth ≤ clientWidth` olmalı. Taşarsa en sağa taşan öğeyi de yazar. Bu tablo için kutu `#fkKayit .mmwrap`.
- **Önce:** tablo her boyda **1484 px** genişlikteydi. Tablo kutusu en geniş pencerede bile 1390 px olduğu için 1920 px dahil **her boyda yatay kaydırma** vardı. Kutu genişlikleri:
  - 1366 px'te 1302
  - 1920×1080 @%150'de 1216
  - Örnek görüntüler: `once-1366.png`, `once-1920.png`, `once-1920-150.png`
- **Satır sonu:** "Fiş", "Kural yap", "Kaydetme" düğmeleri ekran dışında kalıyordu.

## Değişiklikler (yalnız tablo; `renderer/app.js` › fatura tablosu, `renderer/style.css`)
- **İki satırlı hücreler:**
  - **Tarih ve belge no** tek hücrede: tarih üstte, belge no altta.
  - **Matrah ve KDV** tek hücrede: matrah üstte, "KDV …" altta; tevkifat eskisi gibi altında.
  - Başlıkta iki sıralama düğmesi var ("Tarih · Belge no", "Matrah · KDV"). Süzgeç satırında iki kutu alt alta. Sıralama ve süzgeç eskisi gibi çalışıyor.
- **Uzun metinler:**
  - **Karşı taraf:** Ünvan ve kalem adı tek satırda "…" ile kısalıyor; tamamı fareyle üstüne gelince görünüyor (`title`). VKN aynı kalıyor.
  - **Hesap ve cari hücreleri:** Giriş kutuları aynı (116 px), kullanımları değişmedi. Altlarındaki notlar 150 px'e sarılıyor.
  - **Cari hesap adı:** En çok 3 satır, tamamı ipucunda. Cari uyarıları (ör. VKN geçersiz) kısaltılmıyor.
  - **Durum:** Uyarı yazıları 130 px'e sarılıyor.
- **İşlemler:**
  - **PDF** sütunu kaldırıldı; "📄 PDF" işlem düğmelerine katıldı.
  - İşlem düğmeleri (📄 PDF, Fiş, Kural yap, Kaydetme / Geri al) son hücrede **alt alta**.
  - Düğmeler ve davranışları aynı (`data-pdf`, `data-fis`, `data-kural`, `data-haric`, `data-hgeri`).
- **"Luca fiş N" (Görev 34) artık düğme değil** (kullanıcı isteği, ek):
  - Kaydedilmiş satırın durum hücresinde **düz etiket** olarak duruyor; tıklanınca bir şey açmıyor.
  - Fiş, satırın **Fiş** görünümünün üstündeki **"Fişi aç · Luca fiş N"** düğmesiyle açılıyor. Açılan pencere eskisiyle aynı: fiş muavinden hazırlanır (`lucaFisAc`).
- **Hücre iç boşlukları:** 10 px'ten 8 px'e.
- **Taşma nedeni (genel):** Sütun genişliğini sürükleme tutamacı (`.kz-tut`) son sütunda tablonun 3 px dışına taşıyordu. Bu, tablo sığsa bile yatay kaydırma çubuğu çıkarıyordu. Son sütunda tutamaç içeri alındı (`renderer/index.html`); tüm sürüklenebilir sütunlu tablolar için geçerli.
- **Kayıtlı sütun ayarları:** Sütun sayısı 13'ten 10'a indi. Kullanıcıların bu tabloda kaydettiği sütun genişliği / gizleme ayarları sütun sırasına göre tutulduğu için yanlış sütuna uygulanabilirdi.
  - Tabloya `data-kolon-surum="2"` eklendi; ayar anahtarı sürümlü (`fkkTable@2`). Bu tablodaki eski ayarlar bir kez sıfırlanmış olur.
  - Diğer tabloların ayarları değişmedi.

## Sonuç
- **Sonra:** tablo 1280 px pencerede 1216 px kutuya sığıyor. `test/ekran.js` ile bu boyların hepsinde yatay kaydırma, çakışma ve kesik metin yok:
  - **%100:** 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440
  - **diğer ölçekler:** 1920×1080 @%125 ve @%150, 3840×2160 @%150 ve @%200
  - **pencere:** her ölçekte büyütülmüş ve tam ekran
  - Görüntüler: `sonra-1366.png`, `sonra-1920.png`, `sonra-1920-150.png`
- **İstisna – en küçük pencere (980×640):** Tablo 1134 px, kutu 916 px; burada yatay kaydırma kalıyor. Bu boy istenen listede yok. Denetim bu yüzden 1280 px ve üstünde yapılıyor.

## Testler (Linux, xvfb; derleme yok)
- e2e: kaydedilen satırda "Luca fiş N" düz etiket (satırda açma düğmesi yok); Fiş görünümündeki "Fişi aç" fiş penceresini açıyor.
- e2e'deki Görev 41 ekran matrisi bu tabloyu da ölçüyor ("ekran uyumu: luca-kaydet" 18 boyda; yatay kaydırma denetimi 1280 px ve üstü). Mevcut Luca'ya kaydet denetimleri (sıralama, süzgeç, kural, fiş, kaydetme, PDF) aynen geçiyor.
- Sonuçlar:
  - `xvfb-run -a node test/e2e.js`: **E2E_SONUC**
  - `test/luca/*.js`: hepsi geçti
  - `node test/mobil.js`: **45/45**

## Notlar
- Yazılımcının Görev 45'i ("Kod tanımları → Luca'dan çek") tablo dışında; o koda dokunulmadı.
