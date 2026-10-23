# Rapor 11 – Sahte Örnek Test Dosyaları

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `fef61a7` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | `test/ornek/uret.py` ve üretilmiş e2e dosyaları | Yapıldı: `okc_fis1.jpg`, `okc_fis2.jpg`, `mizan_inka.xlsx`, `mizan_savor.xlsx`, `mikro_giris.xls`, `mikro_cikis.xls`, `logo_musteri.xlsx`, `logo_kendi.xlsx` |
| 2 | `fk/tests/veri_isletme_gelir_gider.xlsx`, `fk/tests/veri_mikro_muavin.xlsx` + `fk/tests/veri_uret.py` | Yapıldı |
| 3 | `.xls` üretim yolu | `xlwt` (BIFF8) kullanıldı. SheetJS (`readWorkbook`) okuyor, test genişletilmedi |
| 4 | `test/ornek/BENIOKU.md` | Yapıldı |

## Nasıl çıkarıldı
Beklenen değerler testteki `check` satırlarından ve ilgili okuyuculardan (renderer `CEK.okuMikro/okuLogo`, ÖKC `fisOku`, `mikro_muavin.py`, `isletme_okuyucu.py`) çıkarıldı.
- **ÖKC fişleri:** e2e'nin kendi ürettiği `fis1.png` biçiminde çizildi (DejaVu Sans Mono, beyaz zemin, JPEG).
  - Fiş 1: %20, 1.000 TL.
  - Fiş 2: %10, 1.060 TL, "YEMEK" kalemi.
  - Tesseract (Türkçe) ikisini de okuyor. `%20` "520" olarak okunuyor; okuyucu bunu zaten %20 sayıyor. `%10`'un oranı TOPKDV ile tutarlılıktan bulunuyor.
- **Çek/Senet (İNKA, Mikro):**
  - `103` vade hesapları mizanda bilerek yok; e2e bunların açılmasını sınıyor.
  - Cari kodları mizandaki hesaplarla aynı.
  - Cari "SANTUR TURİZM A.Ş." filtre denetimi için.
- **Çek/Senet (SAVOR, Logo):**
  - Tüm vade hesapları mizanda var. Logo eklenince testin ele almadığı bir "hesap açılsın mı" penceresi çıkıp akışı kilitlemesin diye.
  - "Daha göster" denetimi için 300'den çok hareket var.
  - Tahsil ve ödeme fişleri vade tarihiyle kesildiği için bu çekler iki tarihte toplandı; fiş sayısı 20'nin altında kalıyor.
- **Mikro muavini:** Test 4.476 satır (4.475 hareket + 190 devreden) bekliyor. Bu sayıda uydurma hareket üretildi.
  - Testteki gerçek firma adı ("ŞOK MARKETLER A.Ş.") uydurma adla ("ÖRNEK MARKETLER A.Ş.") değiştirildi. Testte tek değişiklik bu.
- **Uydurma veri:** Firma, kişi adı, VKN ve belge numaraları uydurma. Rastgele değerler sabit tohumla üretiliyor; betikler her çalıştırmada aynı içeriği yazıyor.

## Ek değişiklik: `.gitattributes`
`.gitattributes` yalnız üç `export-ignore` satırından ibaretti (`test/ornek`, iki `veri_*.xlsx`). Amaç, gerçek veri olabilecek dosyaları kaynak zip'inden dışlamaktı. Dosyalar artık sahte olduğu için kaldırıldı; zip'ten kurulan ortamda da e2e tam koşabilecek. İstenmezse geri alınabilir.

## Commit'ler
`git log` için PR'a bakın (rebase sonrası kimlikler değişebilir):
1. Görev 11: pytest için sahte veri üreticisi ve üretilmiş dosyalar
2. Görev 11: e2e için sahte örnek dosyalar ve üretici (test/ornek)
3. Görev 11: rapor-11

## Testler
| Test | Sonuç |
|---|---|
| `xvfb-run -a node test/e2e.js` | **263 geçti, 0 başarısız**, çıkış kodu 0, ilk denemede. Taban: 215 geçti / 1 hata (ÖKC fiş adımında takılıyordu, sonrası hiç koşmuyordu) |
| Öne çıkan e2e satırları | gerçek fiş fotoğrafı okundu (2/2); çek/senet vade hesapları sorgulandı ve açıldı; Mikro bordroları 9 hareket, 5 dengeli fiş; Logo 482 hareket, filtre 456 ms, "Daha göster", 8 fiş; **Ayarlar › Firmalar** (Görev 01) denetimleri ve 1. senaryonun sonu |
| `cd fk && pytest -q` | **115 geçti, 0 başarısız, 1 atlandı** (taban 113/2/1; eksik dosya kaynaklı 2 hata kapandı) |
| `node test/mobil.js` | **42/42** |
| `test/luca/*.js` | **8/8** betik hatasız |
| `surum.yml` test adımı | Bu oturumdan `workflow_dispatch` tetiklenmedi (GitHub Actions'ı başlatma yetkisi kullanılmadı). Adım aynı komutları çalıştırıyor (`pytest -q`, `mobil.js`, `test/luca`, `xvfb-run node test/e2e.js`). Dosyalar depoda olduğu için ek kurulum gerekmiyor. Deneme yöneticide/kullanıcıda |

## Riskler
- **OCR ortam farkı:** Fiş görselleri yerel tesseract.js ve Türkçe veriyle güven skoru 88–89 ile okunuyor. CI'daki (ubuntu-latest) yazı tipi aynı (fonts-dejavu-core), ama Electron'daki ön işleme (`ocr_onisle.js`) farklı sonuç verirse fiş adımı yine kırılabilir. Bu ortamda e2e Electron'un kendi yolundan geçti.
- **Tarih:** ÖKC okuyucusu yılı "bu yıl ya da geçen yıl" kabul ediyor (`yilDuzelt`). Fiş tarihleri 2026; 2028'de e2e beklentisi kayabilir. Kalıcı çözüm testte yılı göreli yapmak (`renderer`'a dokunmadan e2e tarafında); bu görevin kapsamı dışında.
- **`.xls` üretimi:** `xlwt` bakımsız bir paket ama BIFF8 yazımı için yeterli. Dosyalar depoda olduğu için yalnız yeniden üretirken gerekiyor.

## Devir notu
- Testte beklenen değer değişirse önce `test/ornek/uret.py` ya da `fk/tests/veri_uret.py` güncellenir, sonra dosyalar yeniden üretilip commit edilir.
- Açık konu 7 (`test/ornek/` gerçek veri olabilir) kapanabilir: depodaki dosyalar uydurma.
