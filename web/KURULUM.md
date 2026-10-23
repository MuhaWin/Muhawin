# MuhaWin web sitesi ve web uygulamaları

Tek bir sunucuda, tek bir `docker compose` ile çalışır. Caddy HTTPS sertifikalarını kendisi alır ve yeniler.

| Adres | Ne çalışır | Kaynak |
|---|---|---|
| `DOMAIN` (ve `www.DOMAIN` → yönlendirme) | Tanıtım sitesi, indirme, sürüm notları | `web/site/` |
| `indir.DOMAIN` | En son kurulum dosyasını (GitHub sürümü) hemen indirtir | `web/site/indir.html` |
| `yonetim.DOMAIN` | Telefon yönetim paneli (yalnız bilgi@smmmantalya.com) | `mobil-yonetim/` |
| `denetim.DOMAIN` | **Mikro Denetim** web sürümü: giriş zorunlu, Luca gerekmez | `fk/fatura_kontrol` (`FK_WEB=1`) |

`DOMAIN` `.env` dosyasında yazılır. Örnek: `muhawin.smmmantalya.com` yazılırsa adresler `muhawin.smmmantalya.com`,
`denetim.muhawin.smmmantalya.com` … olur. Ayrı bir alan adı alındıysa (ör. `muhawin.com.tr`) onu yazın.

## 1. Sunucu (bir kez)

1. Ubuntu 22.04 / 24.04 bir sunucu kiralayın (2 GB RAM yeterli). 80 ve 443 portları açık olmalı.
2. Docker'ı kurun: `curl -fsSL https://get.docker.com | sh`
3. Alan adının DNS panelinde sunucunun IP adresine giden **A kayıtları** ekleyin:
   `DOMAIN`, `www.DOMAIN`, `indir.DOMAIN`, `yonetim.DOMAIN`, `denetim.DOMAIN`
   (ya da tek bir `*.DOMAIN` kaydı ve `DOMAIN` kaydı).
4. Depoyu sunucuya alın ve ayarları yazın:
   ```sh
   git clone <depo adresi> muhawin && cd muhawin/web
   cp .env.example .env
   openssl rand -hex 32          # çıktıyı .env'deki FK_WEB_ANAHTAR= satırına yazın
   nano .env                     # DOMAIN, FK_WEB_IZINLI (giriş yapacak e-postalar)
   docker compose up -d --build
   ```
5. Birkaç dakika içinde `https://DOMAIN` açılır. Sorun olursa: `docker compose logs -f caddy`

## 2. Yeni sürüm çıktığında

1. Her zamanki gibi sürümü GitHub'a yükleyin (OKUBENI.txt → *YENİ SÜRÜM YAYINLAMA*). Kurulu programlar
   güncellemeyi oradan alır; sitedeki indirme düğmesi de en son sürümü oradan bulur.
2. Sitedeki sürüm notlarını yenileyin (OKUBENI.txt'deki `x.y.z YENİLİKLER` bölümlerinden):
   ```sh
   node tools/site_uret.js       # web/site/surum.json yazılır; commit edip push edin
   ```
3. Sunucuda: `git pull && docker compose up -d --build` (site dosyaları doğrudan bağlıdır; yalnız denetim
   kodu değiştiyse yeniden derlenir).

## 3. Mikro Denetim (denetim.DOMAIN)

- Giriş MuhaWin hesabıyla (programdaki e-posta / parola) yapılır. Yalnız `.env`'deki `FK_WEB_IZINLI`
  listesindeki e-postalar girebilir; birden çok hesap virgülle yazılır. Listeyi değiştirince:
  `docker compose up -d`.
- Oturum 12 saat sürer. 15 dakikada 5 hatalı denemede o e-posta / adres 15 dakika kilitlenir.
- Luca'ya bağlanan bölümler (Faturaları Luca'dan Al, toplu kontrol, Luca'ya kayıt, Ayarlar) web sürümünde
  kapalıdır. Faturalar Mikro'dan alınan XML / ZIP, muavin Mikro Excel'i olarak yüklenir.
- Yüklenen belgeler ve raporlar sunucuda `denetim_veri` biriminde saklanır (firma / yıl / ay klasörleri).
  **Bu veriler müşterilerinizin muhasebe verileridir (KVKK):** sunucuyu yalnız siz ve yazılımcınız yönetin,
  düzenli yedek alın:
  ```sh
  docker run --rm -v web_denetim_veri:/veri -v "$PWD":/yedek alpine tar czf /yedek/denetim-$(date +%F).tgz -C /veri .
  ```
- Masaüstü programdaki Mikro Denetim aynen çalışır; web sürümü `FK_WEB=1` olmadan devreye girmez.

## 4. Yeni bir web bölümü eklemek (yazılımcı için)

Luca gerektirmeyen, dosya ya da başka programlardan veri alışverişiyle çalışan bölümler iki yolla eklenir:

**a) Fatura Kontrol uygulamasının içine (önerilen; aynı giriş, aynı veri klasörü)**
1. Sayfayı `fk/fatura_kontrol/web/static/` içine, API'yi `fk/fatura_kontrol/web/app.py`'ye ekleyin
   (Mikro Denetim: `denetim.html` + `/api/denetim*`).
2. Giriş kontrolü `fk/fatura_kontrol/web/giris.py` içindeki ara katmanda; yeni adresler kendiliğinden
   oturum ister. Luca'ya bağlanan ya da bilgisayara özgü bir adres eklerseniz `KAPALI_ON` listesine yazın.
3. Sayfada web sürümünü `/api/saglik` yanıtındaki `web: true` ile anlayın (bkz. `denetim.html` → `webKur`).
4. Test: `cd fk && python -m pytest tests/test_web_giris.py`

**b) Ayrı bir uygulama olarak (kendi alt alan adı)**
1. `docker-compose.yml`'deki örnek servisi açın (imaj ya da `build:`).
2. `Caddyfile`'daki `uygulama.{$DOMAIN}` örneğini açıp adını verin; DNS'e A kaydını ekleyin.
3. `docker compose up -d --build`. Bu uygulamanın girişini kendisi yapmalıdır.

## Yerelde deneme

```sh
cd fk && FK_WEB=1 FK_VERI=./veri-web FK_WEB_GUVENLI_CEREZ=0 FK_WEB_IZINLI=bilgi@smmmantalya.com \
  FK_WEB_ANAHTAR=$(openssl rand -hex 32) FK_SUPABASE_URL=https://rupwlypoblungdfajrya.supabase.co \
  FK_SUPABASE_ANON=<.env.example'daki anahtar> python -m uvicorn fatura_kontrol.web.app:app --port 8000
# tarayıcı: http://127.0.0.1:8000  ·  site: web/site/index.html dosyasını herhangi bir statik sunucuyla açın
```
