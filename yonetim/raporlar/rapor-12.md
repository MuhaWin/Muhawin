# Rapor 12 – PDF Okuyucu Güvenliği (G-B, rapor-02 Y1)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `678cd55` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | Her `pdfjsLib.getDocument({...})` çağrısına `isEvalSupported:false` | Yapıldı: üç çağrının üçü (`renderer/index.html`) |
| 2 | Mümkünse `renderer/vendor/pdf*.js`'yi güncel sürüme yükseltmek | **Yapılmadı, öneri olarak bırakıldı** (gerekçe aşağıda) |
| 3 | Test: e2e tamamı + PDF ekstre okuma | Yapıldı; e2e'ye iki denetim eklendi |

## Bulgunun kapsamı (rapor-02 Y1 güncellemesi)
`renderer/vendor/pdf.min.js` 3.11.174'te üç kullanım var:

| Yer | Ne yapar | Açığın yolu |
|---|---|---|
| `readPdfLines` (banka ekstresi PDF) | yalnız metin (`getTextContent`) | Glif çizimi yok |
| `pdfMetin` köprüsü (Fatura Kontrol sayfasından gelen PDF) | yalnız metin | Glif çizimi yok |
| `ydPdf` (Hızlı Fiş Girişi › yurt dışı faturası) | metin + **ilk sayfayı canvas'a çizer** (`pg.render`) | **Evet**: CVE-2024-4367 yazı tipi glifleri çizilirken `new Function` ile tetiklenir |

- **Kanıt:** Y1 kodla "Doğrulandı" düzeyine çıkıyor (`index.html` ~3933 `pg.render`). Kötü niyetli bir PDF ile deneme yapılmadı.
- **Etki:** Saldırı yolu yurt dışı faturası olarak yüklenen bir PDF. Kod ana pencerede, `window.desktop` köprüsüyle çalışırdı.
- **`isEvalSupported:false`:** pdf.js'nin bu açık için önerdiği önlem. Glif yolları `new Function` ile derlenmez, yorumlanarak çizilir. Metin okuma ve çizim çalışmaya devam eder (e2e'de yurt dışı faturasının ilk sayfa görüntüsü yine çıkıyor).

## Neden yükseltme yapılmadı
- **Sürüm durumu:** Güncel sürüm `pdfjs-dist` 6.4.299. 4.x'ten beri yalnız ES modülü (`pdf.min.mjs`, `pdf.worker.min.mjs`) dağıtılıyor; UMD (`pdf.min.js` → `window.pdfjsLib`) yok.
- **Gereken değişiklikler:**
  - Renderer'da `<script type="module">` ile yükleme ve `window.pdfjsLib` köprüsü.
  - Modül worker (`GlobalWorkerOptions.workerSrc` → `.mjs`).
  - Electron'da `file://` üzerinden modül yükleme. Chromium modül betiklerini `file://` kökeninde kısıtlayabiliyor; gerekirse özel protokol (`protocol.registerSchemesAsPrivileged`) ya da `main.js` değişikliği.
  - API farkları (`getTextContent`, `render` parametreleri) ve `fk/` tarafındaki bağımsız PDF yolları.
- **Değerlendirme:** Bu, `renderer` + `main.js` + derleme ayarına dokunan ayrı bir iş. Bu görevdeki tek satırlık önlem açığı kapatıyor; yükseltme ayrı görev olarak önerildi.

## Öneriler (ayrı görevler)
1. **pdf.js yükseltmesi (M):**
   - Dokunulacak dosyalar: `renderer/vendor/pdf.min.mjs` + `pdf.worker.min.mjs` (6.x legacy build), `renderer/index.html` (yükleme ve 3 çağrı), gerekirse `main.js` (protokol).
   - Test: e2e (yurt dışı PDF + yeni banka ekstresi PDF denetimi).
2. **Kullanılmayan `pdfjs-dist` bağımlılığı (S):**
   - `package.json` → `dependencies`'teki `pdfjs-dist ^3.11.174` kodda hiç kullanılmıyor; program `renderer/vendor` kopyasını kullanıyor.
   - Ama `electron-builder` üretim bağımlılıklarını kuruluma koyuyor, ve `npm audit`'teki zincir (`pdfjs-dist` → `canvas` → `@mapbox/node-pre-gyp` → `tar`, 1 kritik + 4 yüksek) buradan geliyor.
   - `npm uninstall pdfjs-dist` + `package-lock.json`. Paket bağımlılığına dokunduğu için Güncelleme oturumuyla sıraya alınmalı.

## Commit'ler
`git log` için PR'a bakın:
1. Görev 12: pdf.js getDocument çağrılarında isEvalSupported:false
2. Görev 12: e2e'de pdf.js güvenlik ayarı ve banka ekstresi PDF okuma denetimi
3. Görev 12: rapor-12 (ve test düzeltmesi)

## Değişen dosyalar
- `renderer/index.html`:
  - 3 `getDocument` çağrısı ve yükleme satırına açıklama.
  - `window.__app`'e `readPdfLines` eklendi (yalnız test erişimi; davranış değişmedi).
- `test/e2e.js`:
  - Kaynaktaki tüm `getDocument` çağrılarında `isEvalSupported:false` denetimi.
  - Uydurma bir banka ekstresi PDF'i (reportlab) üretilip `readPdfLines` ile okunması. Bu yol daha önce e2e'de sınanmıyordu.

## Testler
| Test | Sonuç |
|---|---|
| `xvfb-run -a node test/e2e.js` | PR açıklamasında |
| PDF adımları | yurt dışı PDF faturası (metin + ilk sayfa çizimi) ve banka ekstresi PDF satırları `isEvalSupported:false` ile okunuyor |
| pytest, mobil | Çalıştırılmadı: `fk/` ve `mobil-yonetim/` değişmedi |

## Kalan
- `fk/` (Python) tarafında PDF okuma yok (fatura görüntüsü XML/XSLT; o Görev 05'te kapandı).
- Yükseltme yapılana dek pdf.js 3.11.174 kalır. Bilinen diğer açıklar için düzenli `npm audit` ve yükseltme görevi önerilir.
