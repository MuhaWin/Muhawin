# MuhaWin – durum (23.10.2026; son derleme **2.9.12 (de8ff1e, exe 159 311 480 bayt)** sohbete gönderildi; GitHub'da YAYINLANMADI — oturumda GitHub deposu bağlı değil)

**KULLANICI KURALI (21.10.2026, 22.10'da tekrarladı): İstekleri yap, test et, commit et ve kullanıcıya bilgi ver; programı DERLEME / PAKETLEME / TESLİM ETME. Kurulum dosyalarını yalnız kullanıcı "dosyaları oluştur" / "oluştur" / "derle" / "gönder" dediğinde oluştur.**

**ÇALIŞMA BİLGİSAYARI:** Kullanıcı **"mehmet"** bilgisayarında (Windows); klasör **D:\EkstreLuca\MuhaWin**. Bu oturum (git geçmişiyle) desktop-2ncmpij'e bağlı; oraya artık yazılmaz → teslim yalnız SendUserFile (sohbet). **Güncel kaynak: `MuhaWin-kaynak-2.9.12.zip` (de8ff1e)**. Yeni oturumda: stage → /home/claude/muhawin'e aç → `git init` + ilk commit "de8ff1e kaynak" → devam.

EkstreLuca + Fatura Kontrol → **MuhaWin** (Electron kabuk + Python yan süreç). Kurulum: `MuhaWin-<sürüm>-BIRLESTIR.bat` (6 parça). Teslim: SendUserFile (bağlı bilgisayar doğruysa ayrıca device_commit_files; tek çağrıda en fazla 100 MB → parçaları 3'erli; bat en son). Kullanıcı bat'ı parçalar bitmeden çalıştırabiliyor: hepsi inince çalıştırmasını söyle.
Derleme: package.json sürümü → OKUBENI yenilikler (başlık + KURULUM satırındaki sürüm de) → (requirements değiştiyse `python3 tools/python_win.py`) → `npx electron-builder --win nsis --x64 --publish never` (~6 dk) → `split -b 27000000 -d -a 1` → BIRLESTIR.bat (önceki sürümünkinden sed: sürüm + boyut) + latest.yml + blockmap + OKUBENI + `git archive` kaynak zip. Testler: `cd fk && python3 -m pytest -q` (~8 dk, nohup; 103), `xvfb-run -a node test/e2e.js` (250; "Logo fişleri" ara sıra düşer, tekrarda geçer), `node test/mobil.js` (42), `NODE_PATH=/opt/npm-tools/node_modules node test/luca/*.js`. **pkill -f kullanma (kendi kabuğunu öldürüyor).**

## Supabase / güncelleme
GitHub release `McLk007/muhawin-surumler` (etiket v<sürüm>, 3 dosya: exe, exe.blockmap, latest.yml — BIRLESTIR.bat bunları guncelleme-<sürüm> klasörüne koyar).
**23.10.2026 denemesi:** kullanıcı "GitHub'ı bağladım" dedi ama bu oturumda `gh api repos/McLk007/muhawin-surumler` → "GitHub access to this repository is not enabled for this session (add_repo)"; `gh api user` → "No linked GitHub account". add_repo aracı bu oturumda yok. → Depo, oturum başlarken eklenmeli (yeni oturum, depo seçili) ya da kullanıcı kendisi yükler: `/releases/new?tag=v<sürüm>`.
Mobil yönetim paneli: GitHub Pages deposu kuruldu (adres https://mclk007.github.io/<depo>/).

## Modüller
fatura · ekstre · okc · ozel (Çek/Senet, Mikro Denetim) · yonetim · denetim (pasif) · gecici · personel. **Oyun modülü kaldırıldı — önerme.**

## Luca bilgileri (kullanıcıdan)
- Luca aynı anda iki oturuma izin veriyor.
- Sol üstte firma / dönem seçimlerinin altındaki koyu çubukta ("INNOCAP 2026") beyaz pencere düğmesi aynı oturumla yeni Luca sayfası açar. luca.do'yu doğrudan açmak BOŞ sayfa.
- Serbest meslek defteri işletme defteriyle aynı ekranlar; menüde **"Ser.Mes.Defteri"** yazar. Çoğunlukla serbest meslek makbuzu (stopajlı) keser, fatura da kesebilir.
- **Kullanıcı kararı (23.10):** Serbest meslek de **sorgu ve kontrolde işletme gibi** işlenir; defter türü bilinir ve yalnız **kayıt aktarımında** ayrılır.
- **Kullanıcı kararı (23.10, e-SMM):** e-SMM **Satış yalnız serbest meslek defterinde** sorgulanır; e-SMM **Alış tüm firmalarda** sorgulanır. (otomasyon `firma_isle`)
- **Kullanıcı kararı (23.10, pasif aktarım):** İşletme ve serbest meslek için Excel fiş hazırlama ve Luca'ya fiş/fatura aktarma **pasif** ("Çok yakında"). Açmak: renderer `ISLETME_AKTARIM_ACIK`, sunucu `FK_ISLETME_AKTARIM=1`.

## Yön (23.10.2026, kullanıcı): merkezi veri deposu + web sitesi
Program exe olarak kalır. Web sitesi: üyelik + "Programı indir". Üyelik sitede ya da programda. **Faturalar (XML / PDF) kullanıcı bilgisayarında kalır; kurallar, ayarlar vb. ortak veriler merkezi depoda** — sorun: kurallar bilgisayarlar arası paylaşılmıyor. Önerilen: mevcut Supabase (Auth + Postgres + RLS, ofis bazlı) ortak veri deposu; site statik (Cloudflare Pages / GitHub Pages / Vercel) + Supabase Auth; indirme GitHub Releases. Alan adı: .com.tr için yerli kayıt firması, .com için Cloudflare Registrar. Klasik cPanel paylaşımlı hosting önerilmedi (Claude dağıtamaz, API yok). KVKK: Supabase bölgesi (AB) → yurt dışı aktarım; hukukçuya sorulmalı. Kullanıcıdan seçim bekleniyor.

## 2.9.12 (derlendi 23.10.2026; 42ef069 + sürüm de8ff1e)
- Toplu → Sonuçlar ve filtre satırlı tüm listeler: başlık + filtre satırı kayarken üstte (tema.css `table:has(> thead > tr.tg-filtre) > thead{position:sticky}`; önce filtre satırı başlığın üstüne biniyordu); dar pencerede tablo kendi içinde kayar.
- "Kırmızı" tema (renderer `kirmizi` skin + FK `data-tema="kirmizi"`).

## 2.9.11 (derlendi 23.10.2026; 4f4d21c + e8c1366)
- Luca girişi arka planda, doğrulama kodu programda (gizli giriş penceresi, `luca.captchaGir`, "Yeni kod", "Luca'yı göster"); toplu kontrolde (Playwright) de kod programda (`captcha_programda`, `/api/toplu/captcha`, `static/captcha.js`).
- e-SMM kuralı, pasif aktarım, kaydedilmeyecek kuralları, Luca'da Çalış düzeltmesi + "↩ Muavine dön", Toplu → Firmalar "Kontrol edilmeyenler / edilenler".

## 2.9.10 (derlendi 22.10.2026)
Luca bağlantı durumu ortak; Luca oturumu otomasyonla paylaşılır; hızlı dönüş + captcha Enter; işletme / serbest Gelir-Gider listesi; fiş gruplama.

## Bilinen kalan riskler
- Gizli giriş / kod kutusu, SSO çalışma penceresi, Muavine dön, çerez aktarımı gerçek Luca'da DENENMEDİ.
- Eski ölü oturumlu Luca ana ekranı açıksa yeni girişte program öne gelmeyebilir.
- Luca hata sayfası verse de program bağlı sayıp öne gelir.

## Bekleyen
0. Kaynağı (2.9.12 zip) yeni oturumda aç. 1. Merkezi veri deposu + web sitesi kararı. 2. GitHub erişimi (depo oturuma eklenmeli). 3. 2.9.11/2.9.12 gerçek Luca geri bildirimi. 4. İşletme fişi Luca'ya doğrudan kayıt (pasif). 5. Muhtasar örneği. 6. Luca döviz ID'si; komisyoncu XML; ertelenen 19, 21, 22, 34.

## Testler (2.9.12)
pytest 103/103, e2e 250/250, mobil 42/42, test/luca/* geçti.
