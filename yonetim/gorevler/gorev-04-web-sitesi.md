# Görev 04 – Alan Adı, Barındırma ve Tanıtım Sitesi

**Durum:** Açık · **Uygulayan oturum:** Web Asistanı · **Taban:** `main` · **Dal:** `gorev-04-web-sitesi` · **Mesaj sınırı:** 20 (iş sürerse yönetici devam kartı yazar)

## Amaç (kullanıcı kararı, 23.10.2026)
1. Claude ile sorunsuz çalışan bir sağlayıcıdan alan adı ve barındırma alınacak.
2. MuhaWin için bir internet sitesi kurulacak. Site iki iş görecek:
   - **Tanıtım:** Programın reklamı, özellikler, indirme.
   - **Web modülleri (sonraki aşama):** Programdaki HTML/JS ile çalışabilen bazı modüller programdan çıkarılıp site üzerinden kullandırılacak. Bu görevde yalnız analiz ve altyapı hazırlığı yapılır; programdan modül kaldırılmaz.

Önceki çalışma: `yonetim/belgeler/durum-ve-birlestirme-plani.md` → "Yön: merkezi veri deposu + web sitesi" ve `yonetim/belgeler/bulut-veri-tasarimi.md`. Oradaki ön öneri: statik site (Cloudflare Pages / GitHub Pages / Vercel) + Supabase Auth; .com.tr için yerli kayıt firması, .com için Cloudflare Registrar. Bunu yeniden değerlendir, körü körüne kabul etme.

## Başlarken
1. `yonetim/YONETICI.md` dosyasındaki "İşçi oturum kuralları" bölümünü uygula.
2. Bu kartı ve yukarıdaki iki belgeyi oku.
3. `main` dalından `gorev-04-web-sitesi` dalını aç. Oturum ortamın başka dal zorunlu kılıyorsa onu kullan, PR'da belirt.

## Aşama A – Sağlayıcı önerisi (ilk iş; rapor `yonetim/belgeler/web-saglayici-onerisi.md`)
Karşılaştır (en az 3 seçenek):
- **"Claude ile çalışma" ölçütleri:** Kurulum ve yayın kodla/komut satırıyla yapılabiliyor mu (API, CLI ör. `wrangler`, GitHub'a push ile otomatik yayın)? DNS ve SSL API ile yönetilebiliyor mu? Claude Code bulut oturumundan erişilebilir mi (ağ izni gerekir mi)?
- Alan adı: `.com` ve `.com.tr` (`.com.tr` belge/koşul gerektirir; hangi kayıt firmaları, süreç ve süre).
- Barındırma: statik site + ileride sunucu tarafı (Workers/Functions) ve Supabase ile uyum.
- Fiyat (yıllık, TL/USD), Türkiye'den ödeme, KVKK/veri yeri, Türkçe destek.
- Alan adı önerileri (5–10 aday, ör. muhawin.com / muhawin.com.tr) ve **yalnız uygunluk sorgusu** (WHOIS/RDAP). Satın alma yok.
- **Sonuç:** Tek bir önerilen yol + kullanıcının yapacağı adımlar (hesap açma, ödeme, alan adı alma, yetki/token verme) madde madde. Token ya da şifre isteme yolu: kullanıcı bunları ortam gizli değişkeni olarak ekler; sohbete ya da depoya yazılmaz.

Aşama A bitince raporu commit et, push et ve **yöneticiye bildir**. Yönetici kullanıcıdan karar alana kadar Aşama B'ye devam edebilirsin (B sağlayıcıdan bağımsızdır).

## Aşama B – Tanıtım sitesi iskeleti (`site/` klasörü)
- Statik site (HTML/CSS/az JS; derleme aracı gerekmesin ya da çok hafif olsun). Türkçe. Mobil uyumlu.
- Sayfalar: Ana sayfa (ne işe yarar, kimler için: SMMM ofisleri), Özellikler (modüller: Banka, Muhasebe, Belgeden Fiş, Denetim, Fatura Kontrol vb. — `OKUBENI.txt` ve `renderer/index.html`'den çıkar), İndir (`https://github.com/muhawin/muhawin-surumler/releases/latest`), İletişim, KVKK/Gizlilik taslağı.
- Logo: `renderer/logo.svg` / `logo.png`.
- Müşteri verisi, ekran görüntüsünde gerçek firma/VKN olmayacak. Ekran görüntüsü gerekiyorsa sahte veriyle (`test/sahte_sb.js` örneklerindeki gibi) hazırlanır ya da yer tutucu konur.
- Yerel önizleme: `npx serve site` ya da `python3 -m http.server`; Playwright ile ekran görüntüsü alıp rapora ekle.
- Yayın ayarı seçilen sağlayıcıya göre yazılır ama **yayınlama yapılmaz** (hesap kullanıcıda açılana kadar).

## Aşama C – Web modülleri analizi (rapor `yonetim/belgeler/web-modul-analizi.md`)
Programdaki her modül için tablo: Modül · Bugün nerede çalışıyor (renderer / Python yan süreç / Luca-Playwright / Electron IPC) · Tarayıcıda çalışabilir mi · Engeller · Gerekli sunucu işi · İş büyüklüğü (S/M/L).
- **Değişmez kural:** Faturalar ve müşteri belgeleri kullanıcı bilgisayarında kalır. Web modülleri dosyayı **tarayıcıda** işlemeli; sunucuya fatura/belge yüklenmez. Bunu ihlal eden öneri ayrıca işaretlenir ve kullanıcı kararına bırakılır.
- Luca otomasyonu (Playwright) ve yerel Python gerektiren işler web'e taşınamaz; nedenini yaz.
- Lisans/üyelik: Mevcut Supabase oturumu (`cloud.js`) sitede nasıl kullanılır (anon anahtar + RLS; `service_role` istemciye konmaz).
- Sonuç: İlk taşınacak 1–3 modül önerisi ve her biri için ayrı görev kartı taslağı (dokunulacak dosyalar dahil). Programdan modül kaldırma kararını kullanıcı verir.

## Kurallar
- **Satın alma, hesap açma, ödeme, DNS değişikliği ve yayınlama kullanıcıdadır.** Sen yalnız öner, hazırla, adımları yaz.
- Dokunulacak dosyalar: `site/` (yeni), `yonetim/belgeler/web-*.md`, `yonetim/raporlar/rapor-04.md`. Program dosyalarına (`renderer/`, `main.js`, `luca.js`, `fk/`, `package.json`) **dokunma**.
- Token, şifre, API anahtarı commit edilmez.

## Teslim
- Aşama A sonunda ara push + yöneticiye bildirim (session_01CwZoceP2ZsGsw2AbeDBQ6T, send_message).
- Tümü bitince `Görev 04: Web sitesi (alan adı, barındırma, tanıtım)` başlıklı PR. `yonetim/raporlar/rapor-04.md`: aşama durumları, commit listesi, değişen dosyalar, önizleme ekran görüntüleri, kullanıcı kararı bekleyen konular, devir notu.
