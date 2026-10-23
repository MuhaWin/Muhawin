# Rapor 04 – Web sitesi (alan adı, barındırma, tanıtım, web modülleri)

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 23.10.2026
Dal: `claude/beautiful-bohr-c7x9ij`. Oturum ortamı bu dalı zorunlu kılıyor; kartın istediği `gorev-04-web-sitesi` dalı kullanılamadı.

## Aşama durumları
| Aşama | Durum | Çıktı |
|---|---|---|
| A – Sağlayıcı önerisi | Tamam (uygunluk sorgusu yapılamadı, aşağıda) | `yonetim/belgeler/web-saglayici-onerisi.md` |
| B – Tanıtım sitesi | Tamam. Yönetici kararıyla `site/` yerine `web/site/` | `web/site/`, `tools/site_uret.js`, `web/Caddyfile`, `web/docker-compose.yml`, `web/KURULUM.md` |
| C – Web modülleri analizi | Tamam. Mikro Denetim'in tarayıcıda çalıştığı denendi | `yonetim/belgeler/web-modul-analizi.md`, `web/tarayici-deneme/` |
| Sunucuda Mikro Denetim (kullanıcı isteği, kart dışı) | Hazır, **kullanıcı kararı bekliyor** | `fk/fatura_kontrol/web/giris.py`, `app.py` (FK_WEB=1), `static/giris.html`, `static/denetim.html`, `web/denetim/Dockerfile` |

## Commit'ler
- `0d3c913` MuhaWin web sitesi ve web'de Mikro Denetim
- `3f751fb` Görev 04 Aşama A: web sağlayıcı önerisi
- `81bc14a` Görev 04 Aşama C: web modülleri analizi, tarayıcı denemesi, rapor
- `4b195d8` main birleştirildi; (son commit) site yeni sürüm deposuna geçti

## Değişen dosyalar
- Yeni:
  - `web/` (site, Caddy, compose, Dockerfile, kurulum rehberi, tarayıcı denemesi)
  - `tools/site_uret.js`, `test/site_uret.test.js`
  - `fk/.dockerignore`
  - `fk/fatura_kontrol/web/giris.py`, `fk/fatura_kontrol/web/static/giris.html`, `fk/tests/test_web_giris.py`
  - `yonetim/belgeler/web-*.md`, bu rapor ve ekran görüntüleri
- Değişen:
  - `fk/fatura_kontrol/web/app.py`: yalnız FK_WEB=1 iken giriş ara katmanı, `/api/saglik`'te `web` alanı, kayıt bildirimini atlama
  - `fk/fatura_kontrol/web/static/denetim.html`: web sürümünde firma listesi, yeni firma adı, çıkış; masaüstünde değişiklik yok
  - `OKUBENI.txt`: yayın adımlarına site maddesi
  - `.gitignore`: `web/.env`
- Kart "fk/'ye dokunma" diyor. Bu değişiklikler kartın gelmesinden önce kullanıcının doğrudan isteğiyle yapıldı. Yönetici "şimdilik kalsın" dedi.

## Testler
- `node --test test/site_uret.test.js`: 3/3 geçti.
- `cd fk && python -m pytest tests`: 91 geçti, 18 düştü, 1 atlandı.
  - Düşen 18 test değişiklikten önce de aynı şekilde düşüyordu (karşılaştırıldı: aynı liste). Hepsi Chrome/Luca otomasyonuyla ilgili: `test_luca_otomasyon` 14, `test_isletme` 2, `test_luca_kayit` 1, `test_program` 1. Ortamda Chrome kanalı yok (YONETICI.md açık konu 5).
  - Yeni `test_web_giris.py` 7/7 geçti; `test_muhawin.py` geçiyor.
- Uçtan uca (yerel Caddy + uvicorn + sahte Supabase + Playwright):
  - Site, `www.` yönlendirmesi, `indir.` (kurulum dosyasına yönlendirme), `yonetim.` ve `denetim.` çalışıyor.
  - Denetimde: yanlış parola reddedildi, giriş yapıldı, Luca kutusu gizli, sahte verilerle denetim yapıldı (Matrah 1, Cari 1 sorun), çıkıştan sonra API 401 döndü.
  - Telefon genişliğinde (390 px) yatay kaydırma yok.
- `caddy validate`: geçerli. `docker compose config`: geçerli. Docker imajı bu ortamda derlenemedi (Docker servisi yok).
- Pyodide denemesi: Mikro Denetim değiştirilmeden çalıştı, sonuç sunucuyla aynı (yükleme 2,5 sn, denetim 1,7 sn).

## Önizleme (sahte veri)
- Site, masaüstü: `rapor-04/site-masaustu.png`
- Site, telefon: `rapor-04/site-telefon.png`
- Web denetimi, giriş sonrası: `rapor-04/denetim-web-sahte-veri.png`. Firma adı ve VKN test üreticisinden; gerçek değil.

## Kullanıcı kararı bekleyenler
1. **Belgeler nerede işlenecek:** T (tarayıcı) / S1 (sunucu, hemen sil) / S2 (sunucu, sakla). Yönetici soruyor. Öneri **T**: W1 denemesi bunu uygulanabilir kılıyor ve kuralı bozmuyor.
2. S seçilirse sunucu: Türkiye'de VPS (KVKK) mi, Hetzner (yurt dışı, standart sözleşme) mi?
3. Alan adı: `muhawin.com.tr` (+ isteğe bağlı `muhawin.com`). Uygunluk kayıt firmasında sorgulanmalı.
4. Cloudflare hesabı ve token (GitHub gizli değişkeni olarak). KVKK konusunda hukukçu görüşü (Supabase AB bölgesi dahil).
5. Programdan modül kaldırılması: öneri **kaldırılmasın**.

## Engeller ve eksikler
- **Ağ politikası:** Bu oturumdan WHOIS/RDAP, trabis.gov.tr, GitHub web/API, Pyodide CDN'i ve resmî fiyat sayfaları açılamadı. Bu yüzden:
  - alan adı uygunluğu sorgulanmadı;
  - fiyatlar üçüncü taraf kaynaklardan alındı;
  - sürüm deposunun herkese açık olduğu doğrulanamadı.
- **Sürüm deposu adresi:** `main` birleştirildi; site artık `package.json`'daki yeni depoyu (`muhawin/muhawin-surumler`) kullanıyor (`surum.json` ve yedek bağlantılar). Depo taşınana kadar (açık konu 4) indirme bağlantısı GitHub yönlendirmesine bağlı.

## Devir notu
- Sonraki iş (karar T ise):
  1. Önce Yazılımcı `rapor_kaydet`'i `web/app.py`'den ayırır.
  2. Sonra Web Asistanı W1 (Mikro Denetim tarayıcıda) ve W2'yi (site girişi + lisans) uygular. Taslak kartlar `web-modul-analizi.md` §3'te.
  3. Bu durumda sunucu sürümü (`giris.py`, `web/denetim/`, compose'daki `denetim` servisi) kaldırılabilir. Site ve indirme Cloudflare Pages'e taşınır; Caddy/VPS gerekmez.
- Karar S ise: `web/KURULUM.md`'deki adımlarla VPS kurulur. KVKK yükümlülükleri ve yedekleme kullanıcıdadır.
- Pyodide denemesini yeniden çalıştırmak için `web/tarayici-deneme/deneme.mjs` başındaki adımlar yeterli.
