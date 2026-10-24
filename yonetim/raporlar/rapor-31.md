# Rapor 31 – KDV beyannamesi "PDF'ten oku" yolu için e2e denetimi

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi).

## Yapılanlar
- **Örnek PDF:**
  - `test/ornek/uret.py` dosyasına `beyanname_pdf()` eklendi. reportlab ile tek sayfalık, GİB e-Beyanname çıktısına benzeyen **uydurma** bir KDV1 PDF'i çiziyor.
  - Etiketler solda, tutarlar sağda, aynı satırda. Bu düzen, pdf.js'in metni satır satır birleştirmesini sınıyor.
  - İçerik: Eylül 2026, VKN 1111111114. Toplam matrah 125.000,00 · hesaplanan KDV 25.000,00 · indirilecek KDV 18.400,00 · ödenecek 6.600,00 · devreden 0,00.
  - `invariant=1` ile üretildiği için her çalıştırmada aynı bayt çıkıyor (iki üretimde MD5 aynı).
- **Üretici:** `uret.py` artık grup adıyla çağrılabiliyor: `python3 test/ornek/uret.py beyanname`. Yalnız istenen dosya yazılıyor; mevcut örnek dosyalar (fiş, mizan, Mikro, Logo) yeniden üretilmiyor. Argümansız çalıştırınca eskisi gibi hepsi üretiliyor.
- **Dosyalar:** `test/ornek/kdv1_beyanname.pdf` (24 KB) depoya eklendi. `test/ornek/BENIOKU.md` güncellendi (yeni dosya, reportlab gereksinimi, grup seçimi).
- **E2E** (1. senaryo, Muhasebe › KDV Beyannamesi), gerçek akışın aynısı:
  1. Fatura Kontrol çerçevesindeki beyanname sayfasının kendi `pdfMetin()` işlevi çağrılıyor. Bu işlev PDF'i `postMessage` ile MuhaWin'e gönderiyor.
  2. MuhaWin `app.js` dosyasında **pdf.js 5.7.284** ile metni çıkarıyor (satırlar y konumuna göre birleşiyor) ve sonucu çerçeveye geri yolluyor.
  3. Çıkan metin sunucudaki ayrıştırıcıya (`fatura_kontrol.beyanname.gib_metin_coz`) veriliyor.
- **Yeni denetimler:**
  - PDF metni çıkarıldı; "Toplam Matrah 125.000,00" ve "Ödenmesi Gereken Katma Değer Vergisi 6.600,00" etiket ve tutarıyla aynı satırda.
  - KDV1 kutuları doğru okundu: toplam matrah, hesaplanan KDV, toplam KDV, bu döneme ait indirilecek KDV, indirimler toplamı, ödenecek, sonraki döneme devreden, aylık teslim bedeli, dönem (2026) ve VKN.

Bilinçli olarak dışarıda kalan: sunucudaki `karsilastir` (MuhaWin beyannamesiyle kutu kutu fark) bir kontrol dönemi (`rapor_id`) gerektiriyor. O kısmın Python testleri `fk/tests` içinde. Bu denetim pdf.js'ten ayrıştırıcıya kadar olan yolu kapsıyor.

## Değişen dosyalar
- `test/ornek/uret.py`
- `test/ornek/kdv1_beyanname.pdf` (yeni)
- `test/ornek/BENIOKU.md`
- `test/e2e.js`
- `yonetim/raporlar/rapor-31.md`

Program kodu değişmedi.

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **289 ✓, 0 başarısız** (2 yeni denetim).
- `node test/mobil.js`: **45/45.**

## Not
CI'da e2e'nin çağırdığı `python3`, `fatura_kontrol` paketini içe aktarabilmeli. Öteki e2e adımları da aynı yolu kullanıyor (`test_luca_otomasyon` vb.), yeni bir gereksinim eklenmedi. reportlab yalnız PDF yeniden üretilirken gerekiyor; test sırasında gerekmiyor.
