# Web sitesi – sağlayıcı önerisi (Görev 04, Aşama A)

Hazırlayan: Web Asistanı · 23.10.2026 · Dal: `claude/beautiful-bohr-c7x9ij` (oturum ortamı bu dalı zorunlu kılıyor)
Satın alma, hesap açma ve DNS değişikliği yapılmadı.

## 0. Önce verilmesi gereken karar
Sağlayıcı seçimi, **Mikro Denetim belgelerinin nerede işleneceği** kararına bağlıydı. **Kullanıcı kararı (23.10.2026): T – tarayıcıda.** Bu yüzden yalnız Kademe 1 (§3) uygulanır; VPS gerekmez.

| Seçenek | Gereken barındırma | KVKK |
|---|---|---|
| **T – Tarayıcıda işle** (dosya bilgisayardan çıkmaz; Python kodu Pyodide ile tarayıcıda çalışır ya da JS'ye taşınır) | Yalnız **statik** barındırma | Belge aktarımı yok. Sunucuya yalnız giriş ve lisans bilgisi gider (bugünkü Supabase gibi) |
| **S1 – Sunucuda işle, hemen sil** | VPS (Python + Caddy; `web/` hazır) | İşleme sırasında belge sunucuya gider; sunucu yurt dışındaysa bu **yurt dışı aktarım** sayılır |
| **S2 – Sunucuda işle ve sakla** (bugünkü `web/` uygulaması) | VPS + yedek | S1'in yükümlülükleri + saklama, yedek ve erişim sorumluluğu |

## 1. Seçenekler

| | **A. Cloudflare** (Pages + Registrar + DNS) | **B. Hetzner Cloud** (VPS, Almanya/Finlandiya) | **C. Türkiye'de VPS** (ör. Turhost, İstanbul Gayrettepe) | **D. GitHub Pages** | **E. DigitalOcean** (VPS, Frankfurt) |
|---|---|---|---|---|---|
| Ne çalışır | Statik site; Workers/Functions (JS). Python sunucusu yok | Her şey (Docker, Python, Caddy) | Her şey | Yalnız statik site | Her şey |
| Kodla kurulum / yayın | `wrangler` CLI; GitHub'a push → otomatik yayın; tam API | `hcloud` CLI + API + Terraform; kurulum SSH ile | Panel; API **doğrulanamadı**; kurulum SSH ile | GitHub Actions; push → yayın | `doctl` CLI + API |
| DNS / SSL API ile | Evet / otomatik | Hetzner DNS API (ücretsiz) / Caddy | Panel / Caddy | Evet (GitHub) / otomatik | Evet / Caddy |
| Bu bulut oturumundan erişim | Hayır: ağ izni yok (WHOIS/RDAP dahil dış adresler kapalı). Yayın **GitHub Actions** ile yapılır | Aynı: GitHub Actions + SSH anahtarı (gizli değişken) | Aynı | Doğrudan (GitHub) | Aynı |
| Fiyat (yaklaşık, doğrulanmadı) | Pages ücretsiz. `.com` ≈ 10,5–11 USD/yıl, kâr payı yok | CX22/CX23 ≈ 4–4,5 EUR/ay (Nisan 2026 zammı sonrası; bazı modeller stokta yok) | VPS 1 (1 vCPU, 1 GB) ≈ 4,5 USD/ay + KDV; 2 GB üstü önerilir | Ücretsiz | Basic 2 GB ≈ 12 USD/ay |
| Türkiye'den ödeme | Kredi kartı (USD) | Kredi kartı (EUR) | TL, fatura, Türkçe destek | — | Kredi kartı (USD) |
| Veri yeri / KVKK | ABD/küresel CDN (statik site için sorun değil) | AB: yurt dışı aktarım | **Türkiye: aktarım yok** | ABD (statik) | AB: yurt dışı aktarım |
| `.com.tr` | Kaydı yok; yerli firmadan alınıp NS Cloudflare'e yönlendirilir | Kaydı yok | Evet (yerli kayıt kuruluşu) | Kaydı yok | Kaydı yok |

**Notlar**
- **KVKK:** 2024 değişikliğinden sonra açık rıza artık genel aktarım dayanağı değil. Yurt dışı aktarımda (Hetzner, DigitalOcean ve Supabase'in AB bölgesi) **standart sözleşme** imzalanıp 5 iş günü içinde Kurum'a bildirilmesi gerekir. Müşteri muhasebe belgeleri için bu konu bir hukukçuya sorulmalı. Lisans/üyelik verisi bugün de Supabase'de (yurt dışı); ayrı bir konu, aynı soruyla birlikte sorulmalı.
- **Fiyatlar:** Bu ortamdan resmî fiyat sayfaları açılamadı. Rakamlar üçüncü taraf kaynaklardan; satın almadan önce sağlayıcının sayfasında kontrol edilmeli.
- **Klasik cPanel hosting:** Önerilmedi. API yok, Python/Docker çalışmaz, Claude dağıtamaz.
- **Önceki öneriye göre:** Durum belgesindeki "statik site + Supabase Auth" önerisi T seçeneğinde hâlâ en doğrusu. S1/S2 seçilirse statik barındırma yetmez, VPS gerekir.

## 2. Alan adı

**`.com.tr` koşulları:** 14.09.2022'de TRABİS'e geçildi. Bundan sonra `com.tr`, `net.tr` ve `org.tr` **belgesiz, ilk gelen alır** usulüyle veriliyor. Başvuru BTK'nın yetkili kayıt kuruluşları (yerli firmalar) üzerinden yapılır. Kimlik/vergi bilgisi istenir; süreç genelde aynı gün tamamlanır (kayıt kuruluşuna göre değişir). Güncel koşullar nic.tr / trabis.gov.tr'den doğrulanmalı; bu ortamdan açılamadılar.

**Adaylar** (öncelik sırasıyla):
1. `muhawin.com.tr`
2. `muhawin.com`
3. `muhawin.tr`
4. `muhawin.net`
5. `muhawin.app` (yalnız HTTPS; uygun)
6. `muhawinapp.com`
7. `getmuhawin.com`
8. `muhawin.smmmantalya.com` (alt alan adı; **satın alma gerekmez**, mevcut alan adınızın DNS'ine kayıt eklenir)

**Uygunluk sorgusu yapılamadı.** Bu oturumun ağ politikası WHOIS/RDAP adreslerini engelliyor (rdap.org, rdap.verisign.com, trabis.gov.tr erişilemedi). Web aramasında "muhawin" adına yayında bir site çıkmadı; bu yalnız zayıf bir işaret. Kullanıcı kayıt firmasının sitesinde sorgulamalı (1 dakika). Ya da ortamın ağ izinlerine `rdap.org` eklenirse sorguyu ben yaparım.

## 3. Önerilen yol (tek yol, iki kademe)

**Kademe 1 – her durumda (site, indirme, yönetim paneli):**
- Alan adı: `muhawin.com.tr` yerli bir kayıt kuruluşundan alınır. İsteğe bağlı olarak `muhawin.com` da Cloudflare Registrar'dan alınıp ana adrese yönlendirilir.
- DNS: Cloudflare (ücretsiz, API'li). `.com.tr`'nin ad sunucuları Cloudflare'e yönlendirilir.
- Site: **Cloudflare Pages**. `web/site/` klasörü, `main`'e push edilince GitHub Actions ile yayınlanır. `indir.` ve `yonetim.` alt adları da Pages ile (yönlendirme / ikinci proje) ya da mevcut GitHub Pages ile verilir.
- Maliyet: alan adı ücreti dışında 0.

**Kademe 2 – yalnız S1/S2 seçilirse (denetim. alt adı):**
- **Türkiye'de veri merkezi olan bir VPS** (en az 2 GB RAM). KVKK açısından en temiz seçenek; `web/docker-compose.yml` olduğu gibi çalışır.
- Kullanıcı yurt dışını kabul ederse daha ucuz ve API'li seçenek **Hetzner Cloud**; standart sözleşme yükümlülüğü kullanıcıda kalır.
- Yayın: GitHub Actions → SSH → `docker compose up -d --build`.

T seçilirse Kademe 2 gerekmez. Denetim de Pages üzerinde, tarayıcıda çalışır.

## 4. Kullanıcının yapacakları
1. ~~Karar: T / S1 / S2~~ → T verildi (23.10.2026); VPS adımı (5) uygulanmaz.
2. Alan adı uygunluğunu kayıt firmasında sorgulayın; `muhawin.com.tr`'yi (isteğe bağlı olarak `muhawin.com`'u da) satın alın.
3. Cloudflare'de ücretsiz hesap açın → "Add a site" → alan adını ekleyin. Cloudflare'in verdiği iki ad sunucusunu kayıt firması panelinde girin.
4. Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" şablonuyla token oluşturun. Token'ı **GitHub deposu → Settings → Secrets and variables → Actions** altına `CLOUDFLARE_API_TOKEN` adıyla ekleyin; hesap kimliğini de `CLOUDFLARE_ACCOUNT_ID` adıyla. Token sohbete ya da depoya yazılmaz.
5. (Yalnız S) VPS'i satın alın. Bir SSH anahtarını `VPS_SSH_KEY`, sunucu IP'sini `VPS_HOST` adıyla aynı yere gizli değişken olarak ekleyin.
6. (İsteğe bağlı) Bu oturumdan doğrudan kontrol yapabilmem için ortam ağ izinlerine `api.cloudflare.com` ve `rdap.org` eklenebilir.

Bu adımlardan sonra yayın iş akışını (`.github/workflows/site.yml`) ben hazırlarım. Yayını ilk kez kullanıcı onaylar.

## Kaynaklar
- Hetzner fiyatları (Nisan 2026 değişikliği, stok durumu): https://agentdeals.dev/hetzner-pricing-2026 · https://www.vincentschmalbach.com/hetzner-cheap-cloud-unavailable-price-increases/ · https://vpsbenchmarks.com/hosters/hetzner/plans/cx22
- Cloudflare Registrar `.com` fiyatı: https://costgoat.com/pricing/cloudflare-domains
- DigitalOcean Basic 2 GB: https://www.vpsbenchmarks.com/hosters/digitalocean/plans/std_2gb_1core
- Turhost VPS / veri merkezi: https://www.whtop.com/tr/plans/turhost.com/88336
- TRABİS, belgesiz `com.tr`: https://www.gonen.com.tr/?p=11128 · https://www.managingip.com/article/2gsdp9npkn9iw6vkl0rnr/ipstars/beginning-of-trabis-era-recent-shift-in-application-regarding-tr-domain-names
- KVKK yurt dışı aktarım (2024): https://www.ey.com/tr_tr/insights/law/kvkk-degisikliginin-yurt-disi-veri-aktarimina-etkisi · https://www.alomaliye.com/2024/10/30/kvkk-standart-sozlesme-bildirim-modulu/
