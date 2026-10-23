# Rapor 28 – Satır içi betikler ayrı dosyaya, CSP'den `script-src 'unsafe-inline'` kaldırıldı (rapor-02 G-J)

**Durum:** Yapıldı, tek aşamada. Önce splash, sonra index; ikisi de bitti, kalan iş yok. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi).

## Yapılanlar
| Dosya | Değişiklik |
|---|---|
| `renderer/splash.html` | Satır içi `<script>` bloğu `renderer/splash.js` dosyasına taşındı (sürüm yazısı ve `setDurum`). CSP: `script-src 'self' 'unsafe-inline'` → **`script-src 'self'`**. |
| `renderer/index.html` | Tek satır içi `<script>` bloğu (yaklaşık 6.360 satır, `(function(){'use strict'; … })()`) olduğu gibi `renderer/app.js` dosyasına taşındı. Yükleme sırası aynı: vendor betikleri → `app.js` → `yonetim.js`. CSP: `script-src 'self' 'unsafe-inline'` → **`script-src 'self'`**. `index.html` 6.658 satırdan 284 satıra indi. |
| Satır içi olay öznitelikleri | Taramada `onclick=`, `onload=` vb. öznitelik ve `javascript:` adresi **bulunmadı**, ne HTML'de ne `innerHTML` şablonlarında. Program olayları zaten `addEventListener` ya da `el.onclick = …` (JS özelliği; CSP'den etkilenmez) ile bağlıyor. Çevrilecek bir şey çıkmadı. |
| `main.js` | Değişmedi. Açılış ekranına `webContents.executeJavaScript("setDurum(…)")` ile yazılıyor. Bu, sayfanın CSP'sine tabi değil; e2e'de açılış ekranının ilerleme yazdığı doğrulandı. |
| `package.json` › `build.files` | `renderer/**/*` yeni `app.js` ve `splash.js` dosyalarını da kapsıyor; değişiklik gerekmedi. |

Değişmeyenler:
- `style-src 'unsafe-inline'` kaldı. `<style>` blokları ve `style="…"` öznitelikleri çok; bu iş ayrı bir görev olur.
- `'unsafe-eval'` zaten yoktu, yine yok.

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **286 ✓, 0 başarısız.**
- `node test/mobil.js`: **45/45.**
- Yeni e2e denetimleri:
  - `index.html` ve `splash.html` dosyalarında satır içi betik ya da `on…=` özniteliği yok, CSP `script-src`'de `unsafe-inline` yok
  - oturum boyunca konsolda **CSP ihlali yok** ("Refused to execute …" iletileri izleniyor)
  - açılış ekranı betiği (`splash.js`) çalışıyor: "Sürüm 2.9.13" ve ilerleme yüzdesi yazıyor
- Güncellenen denetim: pdf.js `isEvalSupported:false` denetimi artık `app.js` dosyasını okuyor (kod oraya taşındı).

## Riskler
- Bu PR'dan sonra `index.html`'e satır içi `<script>` ya da `onclick="…"` eklenirse CSP onu sessizce engeller; özellik çalışmaz. E2E'deki CSP denetimi bunu yakalar.
- Yazılımcı ve öteki işçiler için: arayüz kodu artık **`renderer/app.js`** dosyasında. `index.html` yalnız iskelet HTML'i taşıyor. Açık dallarda `index.html` betik bölümünü değiştiren iş varsa birleştirmede çakışır; değişikliğin `app.js`'e taşınması gerekir.

## Devir notu
G28 tamam. İsteğe bağlı sonraki adım: `style-src 'unsafe-inline'`'ı kaldırmak (satır içi stillerin CSS sınıflarına taşınması; büyük iş).
