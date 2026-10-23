# Görev 11 – Sahte Örnek Test Dosyaları

**Durum:** Açık · **Uygulayan oturum:** Yazılımcı · **Taban:** `main` · **Büyüklük:** M

## Neden
`test/ornek/` ve `fk/tests/veri_*.xlsx` depoda yok (gerçek müşteri verisi olabileceği için hiç eklenmedi; kullanıcıda da dosya yok – açık konu 7). Bu yüzden e2e 250 yerine ~215 adımda ÖKC OCR adımında takılıyor, pytest'te 2 test düşüyor ve sürüm iş akışı (`surum.yml`) test adımı kırmızı; gerçek yayınlar "testleri atla" olmadan yapılamıyor.

## Yapılacaklar
Tüm dosyalar **üretici betiklerle sahte veriden** oluşturulur (gerçek firma, VKN, TCKN, kişi adı yok; VKN'ler geçerli biçimde ama uydurma):
1. `test/ornek/uret.py` (ya da `.js`): aşağıdakileri üretir ve depoya **üretilmiş hâlleriyle** eklenir (testler ağsız/hızlı kalsın):
   - `okc_fis1.jpg`, `okc_fis2.jpg`: e2e.js:530'daki beklenen değerleri veren ÖKC fişi görüntüleri (Pillow ile çizilmiş metin; DejaVu yazı tipi). OCR'ın bulutta da okuyabileceği netlikte.
   - `mizan_inka.xlsx`, `mizan_savor.xlsx` (e2e.js:621), `mikro_giris.xls`, `mikro_cikis.xls` (e2e.js:633), `logo_musteri.xlsx`, `logo_kendi.xlsx` (e2e.js:682): e2e'nin beklediği sütun düzeni ve sayılarla. Beklenen değerleri testteki `check` satırlarından çıkar.
2. `fk/tests/veri_isletme_gelir_gider.xlsx`, `fk/tests/veri_mikro_muavin.xlsx`: ilgili testlerin beklediği düzende; üretici `fk/tests/veri_uret.py`.
3. `.xls` (eski Excel) gerekiyorsa üretim yolu belgelenir (ör. `xlwt`); mümkün değilse testi aynı içerikli `.xlsx` kabul edecek şekilde genişletmek yerine yöneticiye sor.
4. `test/ornek/BENIOKU.md`: dosyaların sahte olduğu ve nasıl üretildiği.

## Kabul
- `xvfb-run -a node test/e2e.js` **tamamı** geçer (250 + sonradan eklenenler); pytest'te eksik dosya kaynaklı hata kalmaz.
- Görev 01'in "Ayarlar › Firmalar" denetimi dahil 1. senaryonun sonu çalışır.
- İş akışı `surum.yml` test adımı bu dosyalarla yeşile döner (PR'da `workflow_dispatch` ile `teslim=deneme` denemesi yapılabilir; yayın yok).
- Rapor `yonetim/raporlar/rapor-11.md`, PR `Görev 11: Sahte örnek test dosyaları`, yöneticiye bildir.

## Kurallar
Gerçek müşteri verisi kullanılmaz ve istenmez. `renderer/`, `main.js` değişmez (test seçicileri hariç gerekirse yalnız `test/`).
