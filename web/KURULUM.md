# MuhaWin web sitesi

**Kullanıcı kararı (23.10.2026):** Web modüllerinde belgeler **tarayıcıda** işlenir. Fatura ve muavin dosyaları
kullanıcının bilgisayarından çıkmaz; sunucuya yalnız giriş ve lisans bilgisi gider (Supabase, programdaki gibi).
Bu yüzden sitede çalışan bir sunucu programı yoktur; site tamamen statiktir.

| Adres | Ne çalışır | Kaynak |
|---|---|---|
| `DOMAIN` (`www.DOMAIN` → yönlendirme) | Tanıtım sitesi, indirme, sürüm notları | `web/site/` |
| `indir.DOMAIN` | En son kurulum dosyasını (GitHub sürümü) hemen indirtir | `web/site/indir.html` |
| `yonetim.DOMAIN` | Telefon yönetim paneli (yalnız bilgi@smmmantalya.com) | `mobil-yonetim/` |
| `DOMAIN/denetim/` | Muhasebe Denetimi, tarayıcıda (Pyodide); giriş `DOMAIN/giris.html` | `web/denetim/` + `fk/fatura_kontrol` (derlemede) |

## Önerilen yol: Cloudflare Pages (ücretsiz)
Ayrıntı ve gerekçe: `yonetim/belgeler/web-saglayici-onerisi.md`. Site GitHub Actions ile derlenip yayınlanır
(`.github/workflows/site.yml`): Pyodide ve Python paketi derleme sırasında siteye eklenir, testler (sahte veriyle)
geçmeden yayın yapılmaz.

**Kullanıcının bir kez yapacakları**
1. Alan adını alın (`muhawin.com.tr`; isteğe bağlı `muhawin.tr` → yönlendirme).
2. Cloudflare'de ücretsiz hesap açın → **Add a site** → alan adını yazın → Free plan. Cloudflare'in verdiği iki ad
   sunucusunu (nameserver) alan adını aldığınız firmanın panelinde girin. Etkinleşmesi birkaç saati bulabilir.
3. Cloudflare → **Workers & Pages → Create → Pages → Upload assets** → proje adı `muhawin` → boş bir dosya yükleyip
   oluşturun (içeriği Actions dolduracak). Projede **Custom domains** → `muhawin.com.tr` ve `www.muhawin.com.tr`.
4. Cloudflare → sağ üst profil → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** şablonu →
   oluşturun. Hesap kimliği (Account ID) Workers & Pages sayfasının sağında yazar.
5. GitHub → `MuhaWin/Muhawin` → **Settings → Secrets and variables → Actions**:
   - **Secrets:** `CLOUDFLARE_API_TOKEN` (4. adımdaki token), `CLOUDFLARE_ACCOUNT_ID`
   - **Variables:** `SITE_YAYIN` = `1` (otomatik yayını açar). Proje adı farklıysa `CF_PAGES_PROJE`.
   Token'ı sohbete ya da bir dosyaya yazmayın; yalnız bu ekrana yapıştırın.
6. İlk yayın: GitHub → **Actions → MuhaWin site → Run workflow** → "yayınla" işaretli. Bundan sonra `main`'e her
   birleştirmede site kendiliğinden yenilenir. İsterseniz **Settings → Environments → site** altında "Required
   reviewers" ile her yayın için onay isteyebilirsiniz.

**Alt adresler**
- `indir.muhawin.com.tr`: aynı Pages projesine özel alan adı olarak eklenir; **Rules → Redirect Rules** ile
  `indir.muhawin.com.tr/*` → `https://muhawin.com.tr/indir.html`.
- `yonetim.muhawin.com.tr`: ikinci bir Pages projesi (`mobil-yonetim` klasörü) ya da GitHub Pages için CNAME.
- Muhasebe Denetimi ana adresin altında çalışır: `https://muhawin.com.tr/denetim/` (giriş: `/giris.html`).

## Yeni sürüm çıktığında
1. Sürüm her zamanki gibi GitHub'a yüklenir (OKUBENI.txt → *YENİ SÜRÜM YAYINLAMA*). Sitedeki indirme düğmesi en
   son sürümü oradan bulur.
2. Sürüm notlarını yenileyin: `node tools/site_uret.js` (`web/site/surum.json` yazılır), commit → PR → `main`.

## Yedek yol: kendi sunucunuz (Caddy)
Statik site istenirse bir VPS'te de yayınlanabilir. `web/Caddyfile` ve `web/docker-compose.yml` bunun için hazır:
```sh
cd web && cp .env.example .env && nano .env      # DOMAIN, ACME_EMAIL
docker compose up -d
```
DNS'te `DOMAIN`, `www`, `indir` ve `yonetim` için sunucunun IP'sine A kaydı gerekir. Caddy HTTPS'i kendisi alır.

## Yerelde önizleme ve testler
```sh
(cd web/denetim && npm ci && pip download --no-deps -r wheels.txt -d wheels)
node tools/site_uret.js --denetim             # web/site/denetim/ üretilir (depoya girmez)
python3 -m http.server -d web/site 8080      # http://127.0.0.1:8080  (giriş gerçek lisans sunucusuna gider)
node --test web/denetim/kopru.test.mjs        # Pyodide'de denetim, sahte veri
python3 web/denetim/site_e2e.py              # tarayıcıda giriş → denetim → Excel, sahte Supabase
```
