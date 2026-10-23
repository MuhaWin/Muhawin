# MuhaWin web sitesi

**Kullanıcı kararı (23.10.2026):** Web modüllerinde belgeler **tarayıcıda** işlenir. Fatura ve muavin dosyaları
kullanıcının bilgisayarından çıkmaz; sunucuya yalnız giriş ve lisans bilgisi gider (Supabase, programdaki gibi).
Bu yüzden sitede çalışan bir sunucu programı yoktur; site tamamen statiktir.

| Adres | Ne çalışır | Kaynak |
|---|---|---|
| `DOMAIN` (`www.DOMAIN` → yönlendirme) | Tanıtım sitesi, indirme, sürüm notları | `web/site/` |
| `indir.DOMAIN` | En son kurulum dosyasını (GitHub sürümü) hemen indirtir | `web/site/indir.html` |
| `yonetim.DOMAIN` | Telefon yönetim paneli (yalnız bilgi@smmmantalya.com) | `mobil-yonetim/` |
| `denetim.DOMAIN` (sonraki iş, W1) | Mikro Denetim, tarayıcıda (Pyodide) | `yonetim/belgeler/web-modul-analizi.md` |

## Önerilen yol: Cloudflare Pages (ücretsiz)
Ayrıntı ve gerekçe: `yonetim/belgeler/web-saglayici-onerisi.md`.

1. Alan adını alın (öneri `muhawin.com.tr`).
2. Cloudflare'de ücretsiz hesap açın → **Add a site** → alan adını yazın. Cloudflare'in verdiği iki ad sunucusunu
   (nameserver) alan adını aldığınız firmanın panelinde girin. Etkinleşmesi birkaç saati bulabilir.
3. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → `MuhaWin/Muhawin` deposu:
   - Production branch: `main`
   - Build command: boş · Build output directory: `web/site`
   - **Custom domains:** `DOMAIN` ve `www.DOMAIN`
4. `indir.DOMAIN`: aynı Pages projesine özel alan adı olarak eklenir. İsteğe bağlı olarak Cloudflare
   **Rules → Redirect Rules** ile `indir.DOMAIN/*` → `https://DOMAIN/indir.html` yönlendirmesi kurulur.
5. `yonetim.DOMAIN`: ikinci bir Pages projesi (çıktı klasörü `mobil-yonetim`) ya da şu anki GitHub Pages yayını
   için CNAME kaydı.

Bundan sonra `main`'e her birleştirmede site kendiliğinden yenilenir. Token ya da şifre depoya yazılmaz; ileride
GitHub Actions ile yayın gerekirse token depo gizli değişkeni (`CLOUDFLARE_API_TOKEN`) olarak eklenir.

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

## Yerelde önizleme
```sh
python3 -m http.server -d web/site 8080     # http://127.0.0.1:8080
```
