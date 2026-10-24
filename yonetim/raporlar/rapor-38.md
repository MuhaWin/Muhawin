# Rapor 38 – ÖİV'li fatura fişi

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `f88e043` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı. Testlerde sahte fatura (UBL) ve sahte hesap planı kullanıldı, müşteri verisi yok.

## Mevcut okuyucu
- **Okuma:** `fatura_okuyucu._invoice_oku` UBL'de `TaxTypeCode` 4080 / 4081 olan vergiyi "Özel İletişim Vergisi" adıyla `diger_vergiler`'e yazıyor. Faturada vergi adı yazılıysa ad korunuyor.
- **Değişiklik:** Okuyucuda değişiklik gerekmedi; yeni testle (`fk/tests/test_oiv_fis.py`) doğrulandı.
- **Ekran:** ÖİV'li alış faturasını adından tanıyor (`ILETISIM | OIV | 4080`, harf ve Türkçe karakter duyarsız).

## ÖİV'li fatura fişi (alış)
| # | Satır | Hesap | Taraf |
|---|---|---|---|
| 1 | Matrah | Satırın gider hesabı (770.xx vb.; kural / geçmiş / kod tablosu) | Borç |
| 2 | ÖİV | 689 altında, adında "ÖİV" ya da "Özel İletişim" geçen hesap | Borç |
| 3 | ÖİV (nazım) | 950 ve 951 altında, adında "ÖİV" ya da "Özel İletişim" geçen hesaplar | 950 borç / 951 alacak |
| 4 | KDV | 191 (geçmiş, kod tablosu, öğrenilmiş hesap) | Borç |
| 5 | Cari | Faturanın **ödenecek tutarı** | Alacak |
| 6 | Fark | Fiş dengede değilse farkın tutarı, **hesap kodu boş** | Fişi eşitleyen taraf |

- **Fark:**
  - ÖİV'li faturada kuruş farkı da (≥ 0,01) ayrı satıra yazılıyor.
  - Program farkın hesabını **seçmiyor**. Eski davranış (679 / 689 otomatik, geçmiş, firma varsayılanı) ÖİV'li faturada kapalı; fark 770'e de atılmıyor.
  - Fark satırında hesap boşken satırda ve fişte **ilk sırada kırmızı hata** görünüyor: "Fiş dengede değil: … fark 0,03 ayrı satırda, hesap kodu boş. Fiş'te farkın hesabını yazın; yazılmadan Luca'ya gönderilmez".
  - Bu hata varken "Luca'ya kaydet" ve "Excel'e aktar" kapalı. Hesabı Fiş'teki satıra siz yazınca açılıyor.
- **Hesap bulunamazsa ya da birden fazlaysa (689, 950, 951 ayrı ayrı):**
  - Hesap uydurulmuyor, açılmıyor; satır hesapsız kalıyor ve fiş gönderilemiyor.
  - **Yoksa:** "ÖİV gideri için 689 altında adında "ÖİV" ya da "Özel İletişim" geçen hesap yok: Fiş'te hesabı yazın ya da Luca'da açın".
  - **Birden fazlaysa:** "… birden fazla hesap var (689.01, 689.06): Fiş'te birini seçin". Fişin altında adayların düğmeleri çıkıyor.
  - Seçilen ya da Fiş'te yazılan ÖİV hesabı **firmada hatırlanıyor** (`fkOivHesap`, `fkOiv950`, `fkOiv951`); sonraki faturalarda sorulmuyor.
- **Ad eşleştirme:** Harf ve Türkçe karakter duyarsız: "ÖİV", "öiv", "OIV", "Özel İletişim", "OZEL ILETISIM". "OIV" kelime olarak aranıyor; başka kelimenin içinde geçmesi sayılmıyor.
- **Eski davranıştaki sorun (giderildi):** 689'da ÖİV adlı hesap yoksa ilk 689 hesabı seçiliyordu. Artık seçilmiyor.

## Değişen dosyalar
- `renderer/app.js` (`FKAYIT`):
  - `oivSec`, `oivMesaj`, `oivHatirla` (eski `oivHesap` yerine).
  - `satirlar`: ÖİV satırları, nazım ve ÖİV'li faturada fark.
  - Fiş altında seçim düğmeleri, olaylar.
- **Görev 39b'nin satır ekle / çıkar kodu:** Değişmedi. Birleştirmede yalnız `satirlar`'ın dönüş satırı birleşti (`{…, cikan, bosEk, secim}`).
- `fk/tests/test_oiv_fis.py` (yeni): ÖİV'li UBL üreteci ve okuma testleri.
- `test/e2e.js`:
  - Görev 38 bölümü.
  - Eski "telefon faturası" ve "elle hesap" vakalarına 950 / 951 nazım satırları eklendi.

## Testler
| Test | Sonuç |
|---|---|
| `pytest fk/tests/test_oiv_fis.py` (yeni) | 3/3 |
| `cd fk && pytest` (tümü) | 168 geçti, 1 atlandı |
| `test/luca/*.js` (13 dosya) | hepsi geçti |
| `xvfb-run -a node test/e2e.js` (main `f88e043` ile birleşik) | **338 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

e2e Görev 38 bölümü (faturalar `test_oiv_fis.oiv_ubl` UBL'inden gerçek okuyucuyla okunuyor):
- **Tam fatura:** Hizmet 1000, ÖİV 75, KDV 215, ödenecek 1290 → **6 satır**: `770 B1000 · 689 B75 · 950 B75 · 951 A75 · 191 B215 · 320 A1290`. Fiş dengede, hata yok.
- **Yuvarlama farkı:** Ödenecek 1290,03 → 7. satır `(boş) B0,03`, cari 1290,03 alacak. Fiş dengede, gönderim hatası ilk sırada; 770'e atılmadı. Fark satırına hesap yazılınca hata kalkıyor.
- **ÖİV hesabı yok:** Açık uyarı, satır hesapsız.
- **İki ÖİV hesabı:** Biri küçük harfle "öiv gideri". Uyarı ve iki adaylı seçim çıkıyor.
- **Ekranda:**
  - Hesapsız fark ve seçilmemiş ÖİV hesabı varken "Luca'ya kaydet" kapalı, seçim düğmeleri var.
  - Seçim firmada hatırlanıyor.
  - Fark hesabı yazılınca kayıt açılıyor.
- Ekran görüntüsü: `rapor-38/oiv-fis.png` (kayıt düğmesi kapalı, ÖİV hesabı boş, hata satırı).

## Kullanıcının gerçek Luca'da deneyeceği adımlar
Program derlendikten sonra (derleme kullanıcı isteyince).
1. **Fatura:** ÖİV'li bir telefon / internet faturası olan dönemi "Faturaları Luca'ya kaydet"te açın, faturanın **Fiş**ine bakın.
2. **Satırlar:** Gider, 689 ÖİV, 950 / 951 ÖİV, 191 KDV ve cari (ödenecek tutar) olmalı.
3. **ÖİV hesapları:** 689 / 950 / 951'de adında "ÖİV" ya da "Özel İletişim" geçen hesap yoksa uyarı çıkar. Hesabı Luca'da açıp mizanı / hesap planını yenileyin ya da Fiş'te yazın.
4. **Fark:** Kuruş farkı olan faturada fark satırı hesapsız gelmeli, "Luca'ya kaydet" kapalı olmalı. Farkın hesabını yazınca açılmalı.

## Riskler ve açık konular
- **Satış faturası:** ÖİV'li satış faturası (operatör firmalar) bu görevin dışında; eskisi gibi "diğer vergi" hesabına gidiyor.
- **950 / 951 zorunlu:** ÖİV'li faturada nazım hesaplar zorunlu tutuldu; yoksa fiş gönderilemiyor. Nazım kullanmayan firma için hesap açılması ya da Fiş'te satırın "−" ile çıkarılması gerekir.
- **Hatırlanan hesap:** Firmada hatırlanan ÖİV hesabı her ÖİV'li faturada kullanılır. Yanlış seçildiyse Fiş'te yeni hesabı yazmak hatırlananı değiştirir.
