# muhawin.com.tr'yi yayına alma – adım listesi

Önce **e-posta** çalışmalı: başka bir adresinizden `muhawin@muhawin.com.tr`'ye deneme e-postası gönderin; Hostinger
webmail'de görünüyorsa başlayın. Şifreleri ve anahtarları **hiç kimseye ve sohbete yazmayın**.

## A. Cloudflare hesabı (10 dk)
1. **cloudflare.com** → *Sign up* → e-posta: `muhawin@muhawin.com.tr`. Gelen doğrulama e-postasındaki bağlantıya tıklayın.
2. Sağ üstteki profil → **My Profile → Authentication → Two-Factor Authentication**: telefonla iki adımlı girişi açın.

## B. Alan adını Cloudflare'e ekleyin (10 dk)
3. **Add a domain** → `muhawin.com.tr` yazın → **Free** planı seçin.
4. Cloudflare kayıt listesini gösterir. Listede şunların olduğunu kontrol edin:
   - **MX**: `mx1.hostinger.com` ve `mx2.hostinger.com`
   - **TXT**: `v=spf1 …` diye başlayan bir kayıt ve `_dmarc` adlı bir kayıt
   - **CNAME**: adında `_domainkey` geçen kayıtlar → bulut simgesi **gri** ("DNS only") olmalı
   Eksik varsa hPanel → **Alan adları → muhawin.com.tr → DNS** sayfasındaki değerleri **Add record** ile aynen ekleyin.
5. Cloudflare'in verdiği **iki ad sunucusunu** (…`.ns.cloudflare.com`) not edin.

## C. Hostinger'da ad sunucularını değiştirin (5 dk + bekleme)
6. hPanel → **Alan adları → muhawin.com.tr → Ad sunucularını değiştir → Özel ad sunucuları** → iki adresi girin → Kaydet.
7. Cloudflare'de **Check nameservers**. "Active" olunca e-posta gelir (birkaç dakika – birkaç saat).
8. **Kontrol:** `muhawin@muhawin.com.tr`'ye yine deneme e-postası gönderin ve ondan yanıt verin. Gidip geliyorsa tamam.

## D. Site için Cloudflare ayarı (10 dk)
9. Cloudflare → **Workers & Pages → Create → Pages → Upload assets** → proje adı **`muhawin`** → boş bir dosya
   yükleyip **Deploy** (içeriği sonra otomatik dolacak).
10. Projede **Custom domains → Set up a domain**: `muhawin.com.tr`, sonra aynı şekilde `www.muhawin.com.tr`.
11. Profil → **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** şablonu → **Create**.
    Çıkan anahtarı kopyalayın (bir kez gösterilir). **Workers & Pages** sayfasının sağındaki **Account ID**'yi de kopyalayın.

## E. GitHub'a ekleyin (5 dk)
12. github.com → **MuhaWin/Muhawin → Settings → Secrets and variables → Actions**:
    - **New repository secret** → ad `CLOUDFLARE_API_TOKEN` → değer: 11. adımdaki anahtar
    - **New repository secret** → ad `CLOUDFLARE_ACCOUNT_ID` → değer: Account ID
    - **Variables** sekmesi → **New repository variable** → ad `SITE_YAYIN` → değer `1`
13. Bitti deyin. İlk yayını **sizin onayınızla** biz başlatırız; birkaç dakika sonra `https://muhawin.com.tr` açılır.

**Takılırsanız:** O ekranın görüntüsünü gönderin (şifre ve anahtar görünmesin).
