# Rapor 20 – Muavin yanlış / eksik okunuyor

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `d1a6353` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya bağlanılmadı; örnekler sahte.

## Muavin nereden okunuyor
- Programdaki bütün muavin ekranları (Mizan / Muavin, Fiş Listesi, Fatura Kontrol, Denetim) tek okuyucuyu kullanıyor: `fk/fatura_kontrol/muavin_okuyucu.py` › `muavin_oku`.
- Fiş Listesi'ndeki fişler bu satırlardan `fisGrupla` (`renderer/index.html`) ile kuruluyor. Okuyucu yanlış satır verirse fiş de yanlış oluşuyor.
- Luca'dan indirme: `luca.js` › `muavinIndir` (Excel Liste, hesap 100–999). Python `/api/muavin/yukle` ucuna gidiyor.

## Kök nedenler
Okuyucu tek bir döküm biçimine göre yazılmıştı. Bu biçimden her sapma satırları sessizce atlıyor ya da yanlış yazıyordu. 24 testlik yeni dosyada 13 test eski okuyucuda kırılıyor.

| # | Durum | Eski davranış | Sonuç |
|---|---|---|---|
| 1 | Başlık "Tarih" / "Fiş No" (küçük harf) | Python'da `"Tarih".upper()` = `"TARIH"`, aranan `"TARİH"` ile eşleşmiyor | **Hiç satır okunmaz** (eksik) |
| 2 | Başlık ya da veri A sütununda değil | Yalnız ilk hücreye bakılıyordu | **Hiç satır okunmaz** |
| 3 | Tutar metin, noktalı ondalık: `"1234.56"` | Nokta binlik sayılıp siliniyordu | **123456**: tutar 100 kat (yanlış) |
| 4 | Tutar `"1,234.56"`, `"(1.234,56)"`, `"1.234,56-"`, `"… TL"`, `"-"` | Hata | Dosya hiç okunmaz |
| 5 | Tarih `2026-09-30`, `30-09-2026`, saatli tarih, Excel seri sayısı (46295) | Tanınmıyordu | Satır atlanır (eksik) |
| 6 | Tarihli **DEVREDEN** / ara toplam satırı | Hareket sayılıyordu | Fazla tutar, dengesiz fiş (yanlış) |
| 7 | Hesap kodu ve adı **ayrı hücrede** (`191.10.20` · `%20 İnd. KDV`) ya da `Hesap Kodu : …` | Hesap başlığı tanınmıyordu | Satırlar **önceki hesaba** yazılır (yanlış hesap, yanlış KDV oranı) |
| 8 | Döküm **birden çok sayfada** | Yalnız 1. sayfa okunuyordu | 2. sayfadan sonrası eksik |
| 9 | Sütun adı farklı ("Borç Tutarı", "Fiş Tipi", "Yevmiye No") | `KeyError` | Dosya hiç okunmaz |

Aynı sınamalar sayfa sonu tekrarlanan başlık ve hesap satırlarında da yapıldı. Eski okuyucu bu durumda doğruydu, yenisi de doğru.

## Düzeltme (`fk/fatura_kontrol/muavin_okuyucu.py`)
- **Başlık satırı:** Satırın herhangi bir hücresinde aranıyor. Türkçe harf ve büyük/küçük harf farkı gözetilmiyor; her alan için birden çok ad kabul ediliyor. Tarih, borç ve alacak sütunları bulunmalı.
- **Tutar:** Son ayraç ondalık sayılıyor. `1.234` (tek nokta + 3 hane) binlik. Parantez ve sondaki eksi negatif; `TL` ve `₺` atılıyor; `-` sıfır. Okunamayan tutar artık dosya, sayfa ve satır numarasıyla hata veriyor.
- **Tarih:** `gg/aa/yyyy`, `gg.aa.yyyy`, `gg-aa-yyyy`, `yyyy-aa-gg`, saatli biçim ve Excel seri sayısı okunuyor.
- **Hareket olmayan satırlar:** Fiş numarası boşsa ve açıklama ya da tip *Devreden / Devir / Nakli Yekün / Ara Toplam / Toplam / Genel Toplam* ile başlıyorsa satır atlanıyor. Fiş numarası olan açılış fişi okunuyor.
- **Hesap başlığı:** `kod ad`, `Hesap Kodu : kod ad` ve ayrı hücrede kod + ad tanınıyor. `191.10.20 Toplamı` satırı hesap adını bozmuyor.
- **Sayfalar:** Tüm sayfalar sırayla okunuyor; hesap ve sütun bilgisi sayfadan sayfaya geçiyor.
- **Fiş no:** Sayı olarak gelen `12.0` artık `12` olarak okunuyor.
- `_tarih` yeni biçimleri İşletme okuyucusunda da tanıyor (aynı yardımcı).

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_muavin_okuyucu.py` (yeni, 24 test) | **24/24**. Eski okuyucuda 13'ü kırılıyor |
| `pytest tests/test_luca_otomasyon.py tests/test_eslestirme.py tests/test_cikti.py tests/test_isletme.py` | **62 geçti**, 1 atlandı (önceden de atlanıyordu) |
| `pyflakes` | temiz |

## Kullanıcıya sorular (sabah)
Okuyucu artık geniş bir biçim yelpazesini kabul ediyor. Hatanın kullanıcıdaki biçimde kesin çözüldüğünü doğrulamak için:
1. Yanlış ya da eksik okunan **bir firmanın bir aylık muavin Excel'i**. Luca → Muavin Defter → Excel Liste; müşteri adları karartılabilir. Depoya konmaz, yalnız biçim için bakılır.
2. Sorun hangi ekranda görüldü? Mizan / Muavin, Fiş Listesi, Fatura Kontrol ya da Denetim.
3. Yanlış görünen bir fişin numarası ve tarihi, Luca'daki hâliyle (satır sayısı, borç ve alacak toplamı).
4. Muavin Luca'dan mı çekildi ("Luca'dan çek") yoksa elle mi yüklendi?

## Riskler
- **Ölçü:** Eski biçimdeki dosyalar aynı sonucu veriyor; mevcut testler değişmeden geçiyor.
- **`1.234` sorunu:** Tek nokta ve 3 ondalık hane binlik sayılıyor (Türkçe biçim). Metinde `1.234` yazıp 1,234 TL kastedilen bir döküm yanlış okunur. Luca tutarları 2 haneli yazdığı için olası değil.
- **Atlanan satırlar:** Yalnız fiş numarası **boş** olan devir ve toplam satırları atlanıyor.
- Web sitesindeki Denetim paketi `fk/fatura_kontrol`'den CI'da yeniden üretiliyor; ek adım yok.
