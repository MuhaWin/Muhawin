# test/ornek – Sahte örnek dosyalar

Bu klasördeki dosyalar **tamamen uydurmadır**. Firma, kişi ve banka şubesi adları, VKN'ler, çek ve belge numaraları ile tutarlar gerçek değildir; gerçek müşteri verisinden türetilmemiştir. Dosyalar `test/e2e.js` tarafından kullanılır.

| Dosya | Kullanıldığı yer (e2e) | İçerik |
|---|---|---|
| `okc_fis1.jpg`, `okc_fis2.jpg` | Hızlı Fiş Girişi › "gerçek fiş fotoğrafı okundu" | Pillow ile çizilmiş ÖKC fişi görüntüleri. OCR (tesseract, Türkçe) okur. Fiş 1: 15/10/2026, fiş no 0004, %20, 1.000 TL, kredi kartı. Fiş 2: 17/10/2026, fiş no 0007, %10, 1.060 TL, kredi kartı, "YEMEK" kalemi |
| `mizan_inka.xlsx`, `mizan_savor.xlsx` | Çek / Senet › firma mizanları | `HESAP KODU` başlıklı mizan. İNKA'da 103 vade hesapları yok (e2e açılmasını ister); SAVOR'da tüm vade hesapları var |
| `mikro_giris.xls`, `mikro_cikis.xls` | Çek / Senet › Mikro bordroları | Mikro çek/senet bordro dökümü (eski Excel, BIFF8). Giriş: 3 bordro, 5 müşteri çeki. Çıkış: satıcıya ciro (2 çek) ve kendi çekimiz (2 çek) |
| `logo_musteri.xlsx`, `logo_kendi.xlsx` | Çek / Senet › Logo listeleri | Logo çek/senet listesi. Müşteri: 260 çek (portföyde, ciro, tahsile, tahsil, iade). Kendi: 60 çek (verildi, ödendi) |

## Üretme
```
python3 test/ornek/uret.py
```
Gerekenler: Pillow, openpyxl, xlwt (`.xls` için) ve DejaVu yazı tipi (`/usr/share/fonts/truetype/dejavu/`). `fk/.venv` içinde kurulum:
`pip install pillow openpyxl xlwt`.

Rastgele değerler sabit tohumla üretilir; betik her çalıştırmada aynı içeriği yazar. Üretilmiş dosyalar depoya eklidir, böylece testler ağsız ve hızlı çalışır. Testin beklediği bir değer değişirse önce `uret.py` güncellenir, sonra dosyalar yeniden üretilir.

Pytest için benzer dosyalar: `fk/tests/veri_uret.py` → `fk/tests/veri_isletme_gelir_gider.xlsx`, `fk/tests/veri_mikro_muavin.xlsx`.
