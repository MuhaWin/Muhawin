# Rapor 32 – Muhasebe Denetimi: "Sitede aç" bağlantısı

**Durum:** Yapıldı. **Site yayına girince birleştirilecek** (yönetici kararı). İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi).
Kullanıcı kararı: program ve site birlikte duracak, eski kayıtlar taşınmayacak. Programdaki denetim aynen çalışıyor.

## Yapılanlar
- **Bağlantı iki yerde:**
  - Ofisinize Özel Çözümler ekranında, kartların altında (yalnız ofise Muhasebe Denetimi tanımlıysa görünür; `#hubSite`)
  - Muhasebe Denetimi ekranının üstünde (`#mdSite`)
- **Metin:** "Muhasebe Denetimi artık sitemizden de kullanılabilir; belgeleriniz bilgisayarınızdan çıkmaz." Yanında **Sitede Aç ↗** düğmesi var.
- **Adres:** `https://muhawin.com.tr/giris.html?geri=/denetim/`. Tek bir sabitte tutuluyor: `renderer/app.js` → `SITE_DENETIM`.
- **Açılış yolu** (`main.js` değişmedi): bağlantı `target="_blank"`. Ana süreçteki mevcut `setWindowOpenHandler` https adresini `shell.openExternal` ile varsayılan tarayıcıda açıyor; program penceresi yerinde kalıyor.
- **Program:** Kart, denetim ekranı, iframe ve veriler değişmedi; denetim programda eskisi gibi açılıp çalışıyor.

## Değişen dosyalar
- `renderer/index.html`: iki boş bant alanı (`#hubSite`, `#mdSite`)
- `renderer/app.js`: `SITE_DENETIM`, `siteBag()`; hub ekranında bant yalnız Muhasebe Denetimi kartı varken görünüyor
- `renderer/style.css`: `.sitebag` biçimi
- `test/e2e.js`:
  - hub'daki kart tıklaması `text=Muhasebe Denetimi` yerine `[data-hub=mikro]` ile yapılıyor (bantta da aynı yazı geçtiği için)
  - 2 yeni denetim
- `yonetim/raporlar/rapor-32.md`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **291 ✓, 0 başarısız.**
- Yeni denetimler:
  - Bant metni ve adres doğru, bağlantı `_blank`. Tıklanınca `shell.openExternal` tam olarak `https://muhawin.com.tr/giris.html?geri=/denetim/` adresiyle çağrılıyor (testte taklit edildi) ve program ekranı yerinde kalıyor.
  - Denetim ekranında bağlantı var; programdaki denetim açılıyor ve sonraki denetim adımları (KDV / matrah / cari, beyanname düğmeleri) aynen geçiyor.
- `node test/mobil.js`: **45/45.**

## Not
Site adresi değişirse yalnız `SITE_DENETIM` sabiti ve e2e'deki beklenen adres güncellenir.
