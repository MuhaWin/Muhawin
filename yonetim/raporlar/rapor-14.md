# Rapor 14 – Kullanılmayan pdfjs-dist ve Electron Pencere/Dosya Güvenliği (rapor-02 G-D: O1, O3, D9, D12)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `032d283` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | Kullanılmayan `pdfjs-dist` bağımlılığı (npm ile) | Kaldırıldı (`npm uninstall pdfjs-dist`; `package.json` + `package-lock.json`). `npm audit --omit=dev`: **1 kritik + 6 yüksek → 3 yüksek**. `tar`, `canvas` ve `@mapbox/node-pre-gyp` zinciri kalktı. Kalanlar: `xlsx` (2) ve `electron-updater` → `builder-util-runtime` (G-G) |
| 2 | **O1:** ana pencerede `will-navigate` engeli | Yapıldı. Ana pencere `renderer/index.html` dışına gidemez. Engellenen `https://` adresi dış tarayıcıda açılır, diğerleri yok sayılır. Sayfa içi `#` ve sorgu değişimi serbest. Kodda ana pencereyi bilerek başka adrese götüren bir yer yok (aranarak doğrulandı) |
| 3 | **O3:** `open-mail` için `mailto:` / `https:` beyaz listesi | Yapıldı. Diğer protokoller (`file:`, `ms-settings:`, `javascript:` …) ve 4.000 karakterden uzun adresler reddedilir. Kullanıcılar (ofis daveti, yönetim e-postası) yalnız `mailto:` kullanıyor |
| 4 | **D9:** `show-in-folder` yol sınırı | Yapıldı. Yalnız programın kaydettiği dosyalar (`save-file`, `data-export`, yönetimin lisans kodu CSV'si; ana süreçte kayıtlı) ve kullanıcı/hesap veri klasörü gösterilir. Tek kullanıcısı olan "Lisans kodu dosyasını göster" düğmesi, kullanıcının kaydetme penceresinde seçtiği yeri göstermeye devam eder |
| 5 | **D12:** çıkışta `%TEMP%\MuhaWin-*` temizliği | Yapıldı. `will-quit`'te `MuhaWin-pdf`, `MuhaWin-faturalar`, `MuhaWin-wa` silinir. WhatsApp fişleri okunurken zaten hesabın `okc` klasörüne kopyalandığı için veri kaybı yok |

## Commit'ler
1. Görev 14: kullanılmayan pdfjs-dist bağımlılığı kaldırıldı
2. Görev 14: ana pencere gezinme engeli, open-mail ve klasörde göster sınırları, geçici klasör temizliği
3. Görev 14: e2e'de pencere ve dosya güvenliği senaryosu (2b)
4. Görev 14: rapor-14

## Değişen dosyalar
- `package.json`, `package-lock.json`:
  - `pdfjs-dist` kaldırıldı.
  - npm `dependencies`'i alfabetik sıraladı ve dosya sonuna satır sonu ekledi; içerik başka değişmedi.
- `main.js`: `createWindow` (`will-navigate`), `open-mail`, `show-in-folder` ve kaydetme işleyicileri (`yazildi`), `will-quit`.
- `test/e2e.js`: yeni senaryo 2b. Dış tarayıcı ve dosya gezgini açılmasın diye `shell.openExternal` / `showItemInFolder` testte kayda alınıyor.
- Dokunulmadı: `renderer/`, `fk/`.

## Testler
| Test | Sonuç |
|---|---|
| `xvfb-run -a node test/e2e.js` | **270 geçti, 0 başarısız** (taban 265 + 5 yeni) |
| Yeni e2e denetimleri | Ana pencere `https://ornek.com/`'a gitmedi ve `window.desktop` yerinde kaldı; adres dış tarayıcıya yönlendirildi. `open-mail`: `mailto:`, `https:` açık; `file:`, `ms-settings:`, `javascript:` red. Klasörde göster: `/etc/passwd` red. Çıkışta üç geçici klasördeki deneme dosyaları silindi |
| `npm audit --omit=dev` | 3 yüksek (önce 1 kritik + 6 yüksek) |
| pytest, mobil | Çalıştırılmadı: `fk/` ve `mobil-yonetim/` değişmedi |

## Riskler
- **D9:** Gelecekte programın kaydettiği yeni bir dosya türü "klasörde göster"le açılacaksa, o işleyicide `yazildi(yol)` çağrılmalı; yoksa düğme hata verir.
- **O1:** Ana pencereden bir iç sayfaya bilerek geçilmesi gerekirse (bugün yok), `will-navigate` koşuluna eklenmeli.
- **D12:** Program çökerse temizlik yapılmaz; bir sonraki normal kapanışta silinir.

## Devir notu
- **Kalan `npm audit` bulguları:**
  - `xlsx` (prototip kirletme, ReDoS; npm'de düzeltme yok) → SheetJS 0.20.x'e geçiş.
  - `electron-updater` 6.3.9 → güncel sürüm.
  - İkisi de G-G (bağımlılık yükseltme) kapsamında.
