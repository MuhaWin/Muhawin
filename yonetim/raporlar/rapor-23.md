# Rapor 23 – Site metinleri, Denetim paketi doğrulaması, Cloudflare adım listesi

Uygulayan: Web Asistanı · 24.10.2026 (gece) · Dal: `claude/beautiful-bohr-c7x9ij` · Taban: `main` 6fc4a98

## 1. Site metinleri (`web/site/index.html`)
2.9.13 ve Görev 17'ye göre gözden geçirildi:
- **Güncelleme:** "yeni sürümleri kendiliğinden indirir / arka planda iner" ifadeleri, programın yeni davranışına göre düzeltildi: açılışta sorar, "Şimdi kur" ile tek tıkla kurulur, "Sonra" işi bölmez.
- **Luca:** "Üst şeritteki tek düğmeyle Luca'ya bağlanırsınız" (2.9.13'teki tek giriş düğmesi).
- **Ofisinize Özel:** "Mikro denetimi" → "Muhasebe Denetimi"; "çek / senet takibi" → "çek / senet kayıtları" (programdaki ad).
- "Belgeden Fiş" ve "Muhasebe Denetimi" adları zaten güncel. Sürüm notları (`surum.json`) 2.9.13'ü gösteriyor; "Yakında" satırı OKUBENI'nin ilk satırından geliyor.
- Tema ve sabit üst şerit sitede anlatılmıyor; değişiklik gerekmedi.

## 2. Denetim paketi (`main` 6fc4a98: Görev 08, 17, 19 dahil)
- `node --test test/site_uret.test.js`: 6/6
- `node --test web/denetim/kopru.test.mjs`: 4/4 (Görev 19'un fiş satırlarındaki `tarih` alanı dahil)
- `python3 web/denetim/site_e2e.py`: 22/22 (CSP etkin, sahte Supabase, sahte veri)

## 3. Kullanıcı için Cloudflare adım listesi
`web/CLOUDFLARE-ADIMLAR.md`: tek sayfa, 13 adım (e-posta denemesi → Cloudflare hesabı + iki adımlı giriş → alan adı ve e-posta kayıtları → Hostinger ad sunucuları → kontrol → Pages projesi ve alan adları → API anahtarı → GitHub sırları → ilk yayın onayı). `web/KURULUM.md` bu sayfaya bağlantı veriyor. Metin yöneticiye ayrıca gönderildi.
