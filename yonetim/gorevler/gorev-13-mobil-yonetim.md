# Görev 13 – Mobil Yönetim Paneli (MuhaWin/Muhawin-yonetim-)

**Durum:** Açık · **Uygulayan oturum:** Web Asistanı · **Taban:** `main` · **Büyüklük:** S–M

## Durum tespiti (yönetici, 23.10.2026)
- Mobil yönetim paneli GitHub Pages'te ayrı depodan yayınlanıyor: `MuhaWin/Muhawin-yonetim-` (tek commit, "Add files via upload" – elle yükleme).
- Kaynağı ana depodaki `mobil-yonetim/`. `index.html` ve `manifest.webmanifest` aynı; `uygulama.js` yalnız Görev 10 ad değişikliklerinde farklı ("Belgeden Fiş", "Muhasebe Denetimi"); ikon PNG'leri bayt olarak farklı (içerik büyük olasılıkla aynı, kontrol et).
- Bu (yönetici) oturumdan o depoya push reddediliyor: Claude GitHub uygulaması o depoda kurulu değil.

## Yapılacaklar
1. **Tek kaynak:** Kaynak her zaman ana depodaki `mobil-yonetim/`. Pages deposuna elle yükleme bırakılır.
2. **Otomatik eşitleme:** Ana depoda `.github/workflows/mobil-yonetim.yml`: `main`'e `mobil-yonetim/**` değişikliği gelince içeriği `MuhaWin/Muhawin-yonetim-` deposuna kopyalayıp commit eder. Yetki: yalnız o depoya "Contents: Read and write" veren fine-grained token, ana depoda `YONETIM_TOKEN` sırrı (kullanıcı ekler; adımları yaz). Sır yoksa iş akışı açık bir uyarıyla durur.
3. **İlk eşitleme:** Görev 10 adlarını Pages'e taşımak. İş akışı kurulana kadar beklemek istenmezse, kullanıcı Claude GitHub uygulamasını o depoya kurarsa (https://github.com/apps/claude/installations/select_target) bu oturumdan doğrudan push edilebilir; yoksa iş akışının ilk çalıştırması bunu yapar.
4. **Güvenlik (rapor-02 D5):** Paneldeki yönetici yenileme belirteci `localStorage`'da. Site girişindeki (W2) gibi bellek + `sessionStorage`'a taşı; "beni hatırla" isteniyorsa kullanıcıya sor. `mobil-yonetim/` içinde yap, `node test/mobil.js` geçmeli.
5. **İleri adım (öneri, karar kullanıcıda):** Panel `yonetim.muhawin.com.tr` olarak Cloudflare Pages'ten sunulabilir (web-modul-analizi.md'deki plan). Bu durumda eski GitHub Pages adresi yeni adrese yönlendiren tek bir sayfaya döner. Kurulu PWA'lar için geçişi raporda anlat.

## Kurallar
- Ana depoda yalnız `mobil-yonetim/`, `.github/workflows/mobil-yonetim.yml`, `test/mobil.js` (gerekirse) ve rapor. `renderer/`, `main.js`, `fk/` dokunulmaz.
- Gerçek Supabase'e istek yok; token sohbete yazdırılmaz.

## Teslim
Rapor `yonetim/raporlar/rapor-13.md` (kullanıcı adımları dahil). Dalı hazırlayıp yöneticiye bildir; PR'ı yönetici açar.
