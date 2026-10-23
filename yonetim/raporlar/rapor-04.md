# Rapor 04 – Web sitesi (alan adı, barındırma, tanıtım, web modülleri)

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 23.10.2026
Dal: `claude/beautiful-bohr-c7x9ij`. Oturum ortamı bu dalı zorunlu kılıyor; kartın istediği `gorev-04-web-sitesi` dalı kullanılamadı.

## Aşama durumları
| Aşama | Durum | Çıktı |
|---|---|---|
| A – Sağlayıcı önerisi | Tamam (uygunluk sorgusu yapılamadı, aşağıda) | `yonetim/belgeler/web-saglayici-onerisi.md` |
| B – Tanıtım sitesi | Tamam. Yönetici kararıyla `site/` yerine `web/site/` | `web/site/`, `tools/site_uret.js`, `web/Caddyfile`, `web/docker-compose.yml`, `web/KURULUM.md` |
| C – Web modülleri analizi | Tamam. Mikro Denetim'in tarayıcıda çalıştığı denendi | `yonetim/belgeler/web-modul-analizi.md`, `web/tarayici-deneme/` |
| Sunucuda Mikro Denetim (kullanıcı isteği, kart dışı) | **Kaldırıldı**: kullanıcı kararı T (tarayıcıda işle, 23.10.2026). `fk/` bu PR'da değişmiyor | — |

## Commit'ler
- `0d3c913` MuhaWin web sitesi ve web'de Mikro Denetim
- `3f751fb` Görev 04 Aşama A: web sağlayıcı önerisi
- `81bc14a` Görev 04 Aşama C: web modülleri analizi, tarayıcı denemesi, rapor
- `4b195d8` main birleştirildi · `5508b92` site yeni sürüm deposuna geçti
- (son commit) Kullanıcı kararı T: sunucu sürümü kaldırıldı, belgeler güncellendi

## Değişen dosyalar (main'e göre)
- Yeni: `web/` (site, Caddy + compose yedek yol, kurulum rehberi, `tarayici-deneme/`), `tools/site_uret.js`, `test/site_uret.test.js`, `yonetim/belgeler/web-*.md`, bu rapor ve ekran görüntüleri.
- Değişen: `OKUBENI.txt` (yayın adımlarına site maddesi), `.gitignore` (`web/.env`).
- `fk/`, `renderer/`, `main.js`, `luca.js`, `package.json`: **değişiklik yok** (sunucu sürümü kaldırıldı).

## Testler
- `node --test test/site_uret.test.js`: 3/3 geçti.
- `fk/` değişmediği için pytest sonucu `main` ile aynı (bu ortamda 84 geçti, 18 düştü, 1 atlandı; düşen 18 test Chrome/Luca, açık konu 5).
- Uçtan uca (yerel Caddy + Playwright): site, `www.` yönlendirmesi, `indir.` (kurulum dosyasına yönlendirme) ve `yonetim.` çalışıyor. Telefon genişliğinde (390 px) yatay kaydırma yok.
- `caddy validate` ve `docker compose config`: geçerli.
- Pyodide denemesi (`web/tarayici-deneme/`): Mikro Denetim değiştirilmeden çalıştı, sunucu sürümüyle aynı sonucu verdi (sahte veri: Matrah 1, Cari 1 sorun; yükleme 2,5 sn, denetim 1,7 sn).

## Önizleme (sahte veri)
- Site, masaüstü: `rapor-04/site-masaustu.png`
- Site, telefon: `rapor-04/site-telefon.png`
- Kaldırılan sunucu sürümünün denetim ekranı (karşılaştırma için): `rapor-04/denetim-web-sahte-veri.png`. Firma adı ve VKN test üreticisinden; gerçek değil. Tarayıcı sürümü (W1) aynı sayfayı kullanacak.

## Kullanıcı kararı bekleyenler
1. ~~Belgeler nerede işlenecek~~ → **Tarayıcıda (T)**, kullanıcı kararı 23.10.2026.
2. ~~Sunucu seçimi~~ → gerekmiyor.
3. Alan adı: kullanıcı alacak (23.10.2026). Öneri `muhawin.com.tr` (+ isteğe bağlı `muhawin.com`); uygunluk kayıt firmasında sorgulanmalı.
4. Cloudflare hesabı ve token (GitHub gizli değişkeni olarak). KVKK konusunda hukukçu görüşü (Supabase AB bölgesi dahil).
5. Programdan modül kaldırılması: öneri **kaldırılmasın**.

## Engeller ve eksikler
- **Ağ politikası:** Bu oturumdan WHOIS/RDAP, trabis.gov.tr, GitHub web/API, Pyodide CDN'i ve resmî fiyat sayfaları açılamadı. Bu yüzden:
  - alan adı uygunluğu sorgulanmadı;
  - fiyatlar üçüncü taraf kaynaklardan alındı;
  - sürüm deposunun herkese açık olduğu doğrulanamadı.
- **Sürüm deposu adresi:** `main` birleştirildi; site artık `package.json`'daki yeni depoyu (`muhawin/muhawin-surumler`) kullanıyor (`surum.json` ve yedek bağlantılar). Depo taşınana kadar (açık konu 4) indirme bağlantısı GitHub yönlendirmesine bağlı.

## Devir notu
- Karar T verildi. Sıradaki işler:
  1. Yazılımcı: `rapor_kaydet`'i `fk/fatura_kontrol/web/app.py`'den yeni `fatura_kontrol/rapor_kayit.py` modülüne ayırır (W1 ön koşulu).
  2. Web Asistanı: W1 (Mikro Denetim tarayıcıda) ve W2 (site girişi + lisans). Taslak kartlar `web-modul-analizi.md` §3'te.
- Kullanıcı alan adını alınca `web/KURULUM.md` → "Önerilen yol: Cloudflare Pages" adımları uygulanır.
- Pyodide denemesini yeniden çalıştırmak için `web/tarayici-deneme/deneme.mjs` başındaki adımlar yeterli.
