# Luca ve Paraşüt API Araştırması (23.10.2026)

## Luca
- İnternette görülen "Luca API Key" dış programın Luca'ya bağlanması için DEĞİL. İki ayrı anahtar var, ikisi de Luca'nın dışarıya bağlanması için:
  1. **TÜRMOB Servis Anahtarı:** ebirlik.turmob.org.tr > Entegrasyon Anahtarı'nda üretilir. Luca > Yönetici > Diğer İşlemler > SM/SMMM Bilgileri > Kurum Şifre Bilgileri'ne girilir. Kullanım: VKN/TCKN cari sorgusu. (lucayazilim.freshdesk.com makale 67000686858)
  2. **GİB Defter Beyan API Key + Secret:** DBS > Sistem Yönetimi > Dış Sistem Kullanıcısı Tanımla > entegratör Luca. Aynı Luca ekranına girilir. Kullanım: işletme/serbest meslek fişlerini DBS'ye otomatik gönderme.
- Dış programdan Luca'ya resmi erişim:
  - **Luca Net Kobi:** "Web Servis Aktarımı API Hizmeti ile Diğer Programlardan Veri Aktarımı (Ücretli)". Doküman kamuya açık değil.
  - **Luca Koza:** Koza Rest API Paketi (StockMount, Üzüm, TreeWin, Orion Pos kullanıyor). Doküman kamuya açık değil.
  - **Luca Mali Müşavir Paketi:** Muavin, mizan okuma veya fatura indirme için kamuya açık API bulunamadı (doğrulanamadı).
- Sonuç: Robot (Playwright) yöntemi sürer. Resmi yol için Luca/TÜRMOB'a yazılı talep gerekir.

## Paraşüt (API v4)
- client_id, client_secret: destek@parasut.com adresine e-posta veya panelde Canlı Destek. redirect_uri varsayılan `urn:ietf:wg:oauth:2.0:oob`.
- Token: `POST https://api.parasut.com/oauth/token`. Grant türü `password` (e-posta+şifre) veya `authorization_code`. access_token 2 saat geçerli. refresh_token her yenilemede değişir.
- İstekler: `https://api.parasut.com/v4/{firma_no}/...`. Rate limit 10 istek / 10 sn.
- İlgili uçlar: contacts, sales_invoices, purchase_bills, e_invoices, e_invoice_inboxes, e_smms.
- Hangi pakette API açık: kaynakta yok, Paraşüt'e sorulmalı.
