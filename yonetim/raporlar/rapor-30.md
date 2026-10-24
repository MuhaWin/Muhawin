# Rapor 30 – pdf.js yükseltmesi (rapor-02 Y1'in kalıcı çözümü)

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi).

## Sürüm
| | Önce | Sonra |
|---|---|---|
| Paket | pdf.js 3.11.174 (`vendor/pdf.min.js`, `vendor/pdf.worker.min.js`; klasik betik, `window.pdfjsLib`) | **pdfjs-dist 5.7.284**: 5.x'in son kararlı sürümü, 27.04.2026 |
| Kaynak | – | `npm pack pdfjs-dist@5.7.284` → `legacy/build/pdf.min.mjs` ve `legacy/build/pdf.worker.min.mjs` |
| Dosyalar | `renderer/vendor/pdf.min.js`, `pdf.worker.min.js` (silindi) | `renderer/vendor/pdf.min.mjs`, `renderer/vendor/pdf.worker.min.mjs` |

Kararlar:
- **Neden legacy derleme:** Electron 31 (Chromium 126) için güvenli seçim. Modern derleme daha yeni tarayıcı özelliklerini (Uint8Array hex/base64 vb.) bekleyebiliyor; legacy derleme bunları kendisi sağlıyor.
- **Neden 6.x değil:** Yönetici "4.x / 5.x" dedi. 6.4.299 da var (03.10.2026); istenirse ayrı görev olarak denenebilir.

## Değişiklikler
- **Yükleme:** `renderer/app.js` içine yeni `pdfKutuphane()` eklendi.
  - Kütüphane ilk PDF okunurken `import('./vendor/pdf.min.mjs')` ile bir kez yükleniyor.
  - `GlobalWorkerOptions.workerSrc = vendor/pdf.worker.min.mjs` atanıyor.
  - Yükleme başarısız olursa "PDF okuyucu yüklenemedi: …" hatası veriliyor ve sonraki denemede yeniden yükleniyor.
- **Üç `getDocument` kullanımı da `pdfKutuphane()` ile alınan kütüphaneyi kullanıyor. Hepsinde `isEvalSupported:false` duruyor:**
  1. banka ekstresi PDF (`readPdfLines`)
  2. Fatura Kontrol › KDV beyannamesi PDF metni (`pdfMetin` iletisi)
  3. yurt dışı fatura / Belgeden Fiş PDF'i (metin ve ilk sayfa görüntüsü; `page.render({canvasContext, viewport})` 5.x'te de aynı)
- **`renderer/index.html`:** Eski iki `<script src="vendor/pdf…js">` satırı kaldırıldı. Açılışta PDF kütüphanesi yüklenmiyor; açılış biraz hafifledi.
- **CSP:** Değişmedi: `script-src 'self'; worker-src 'self' blob:`. Modül ve worker `file://` üzerinden aynı kaynaktan yükleniyor. E2E'de CSP ihlali yok.
- **Worker:** Electron'da gerçek Web Worker çalışıyor (`port instanceof Worker === true`, deneme betiğiyle doğrulandı). Sahte (ana iş parçacığında çalışan) worker'a düşülmüyor.
- **Paketleme:** `package.json` › `build.files` içindeki `renderer/**/*` yeni `.mjs` dosyalarını kapsıyor; değişiklik gerekmedi. `package.json`'da pdfjs-dist bağımlılığı yok; kütüphane yalnız `renderer/vendor`'da.

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **287 ✓, 0 başarısız.** Tüm PDF adımları geçti:
  - banka ekstresi PDF satırları okundu
  - yurt dışı PDF faturası: tarih, fatura no, satıcı, VAT, tutar ve kart okundu; ilk sayfa görüntüsü çıkarıldı
  - dövizli Google faturası okundu
  - ÖKC fiş görüntüsü (OCR) okundu
  - `isEvalSupported:false` denetimi geçti (3 çağrı)
  - CSP ihlali yok
- Yeni e2e denetimi: `vendor/pdf.min.mjs` 5.x (`apiVersion 5.7.284`), worker dosyası var, eski 3.11 dosyaları yok.
- `node test/mobil.js`: **45/45.**

## Riskler
- **KDV beyannamesi PDF yolu:** Fatura Kontrol › KDV beyannamesi "PDF'ten oku" adımının (`pdfMetin`) ayrı bir e2e denetimi yok. Kod öteki iki yolla aynı API'yi kullanıyor; Windows'ta bir beyanname PDF'iyle elle denenmeli.
- **JPX resim:** pdf.js 5'te JPX (JPEG 2000) görüntüleri WebAssembly çözücüyle açılıyor; `wasm/` klasörü taşınmadı. Metin okuma etkilenmez. JPX görüntü içeren bir PDF'in ilk sayfa görüntüsünde o resim boş çıkabilir; 3.11'de de JPX desteği sınırlıydı.
- **Lisans:** pdf.js Apache-2.0; lisans başlığı `.mjs` dosyalarının içinde duruyor.

## Devir notu
G30 tamam. İsteğe bağlı: pdf.js 6.x denemesi ve JPX için `wasm/` klasörünün eklenmesi.
