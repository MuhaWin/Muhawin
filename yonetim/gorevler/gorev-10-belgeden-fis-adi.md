# Görev 10 – "Hızlı Fiş Girişi" → "Belgeden Fiş"

**Durum:** Açık · **Uygulayan oturum:** Menü Düzenleme · **Taban:** `main` · **Büyüklük:** S

## Kullanıcı kararı (23.10.2026)
Modülün görünen adı her yerde **"Belgeden Fiş"** olur (üst sekmede zaten bu ad var).

## Yapılacaklar
Yalnız **görünen metin** değişir; modül kimliği (`okc`), lisans anahtarları, CSS sınıfları ve veri alanları **değişmez**.
- `renderer/index.html` (modül kartı, başlık `#h1Mod`, yardım/palet metinleri; 6 yer)
- `renderer/yonetim.js` ve `mobil-yonetim/uygulama.js` → `MODAD.okc`
- `cloud.js` → modül listesindeki `name` (yalnız `name`; `id: 'okc'` aynı)
- `main.js` → `okcLicensed()` hata mesajı (yalnız metin)
- `test/e2e.js:476` ve `test/mobil.js` gerekiyorsa
- `OKUBENI.txt` 1. satırdaki modül listesi; 134. satırı "Belgeden Fiş (eski adları Hızlı Fiş Girişi, ÖKC Fiş Girişi)" yap
- `web/site/` dokunulmaz (Web Asistanı'na ayrıca bildirildi)

## Kabul
- `grep -rn "Hızlı Fiş Girişi"` yalnız OKUBENI'deki "eski adları" açıklamasında ve eski sürüm notlarında kalır.
- `node test/mobil.js` 42/42; e2e tabandan kötü değil.
- Rapor `yonetim/raporlar/rapor-10.md`, PR `Görev 10: Belgeden Fiş adı`, yöneticiye bildir. Derleme yok.
