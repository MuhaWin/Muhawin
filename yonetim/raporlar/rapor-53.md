# Rapor 53 – Fiş çıktılarında ana hesap özeti ve imza alanları

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `8e87e6e` (#94 dahil) · **Dal:** `claude/awesome-ritchie-ftviuk`
Derleme yapılmadı. Testlerde sahte fişler kullanıldı; müşteri verisi yok.

## İstek
- Fiş PDF görünümü aynen kalsın; fişin altına **"Ana hesap özeti"** eklensin. Fiş satırları ana hesaba (ilk 3 hane) göre toplanır. Her ana hesap için kod, ad (hesap planında varsa), toplam borç, toplam alacak gösterilir.
- Özetin altında borç = alacak denkliği; dengesizse belirtilsin.
- En altta imza alanları: **Hazırlayan / Kontrol Eden / Onaylayan** (ad soyad, tarih, imza).
- Özet **yalnız aynı ana hesap fişte birden çok satırda geçiyorsa** eklensin. İmza alanları her durumda olsun.
- Programdaki bütün fiş yazdır / PDF düğmelerinde ve Excel çıktısında aynı olsun; mümkünse tek ortak yardımcı.

## Fiş yazdıran yerler (tarama sonucu)
| Yer | Düğme | Durum |
|---|---|---|
| Mizan / Muavin / Hesap Planı › muavinde fiş no › fiş penceresi | PDF, Excel | **eklendi** |
| Fatura Kontrol › Fiş Listesi › fiş ayrıntısı | PDF, Excel | **eklendi** |
| Fatura Kontrol › fiş penceresi (`fk/.../static/index.html` `#fisYazdir`) | Yazdır / PDF | **eklendi** (Python, `/api/denetim/fis/yazdir`) |
| Muhasebe Denetimi › fiş penceresi (`denetim.html` `#fisYazdir`, `#fisPdf`) ve web sitesindeki denetim | Yazdır, PDF | **eklendi** (aynı Python sayfası) |
| "Faturaları Luca'ya kaydet", Belgeden Fiş, banka fişleri | – | Fiş yazdıran PDF düğmesi yok; ürettikleri Excel'ler **Luca'ya aktarım dosyası** (Fiş Girişi vb.). Bunlara özet / imza satırı eklenmedi, çünkü Luca içe aktarımını bozar. |
| Muavin / mizan listesi PDF'i, Günün Özeti PDF'i, beyanname PDF'i | PDF | Fiş değil; değişmedi. |

## Yapılanlar
- **Ortak yardımcı, iki eş (aynı kural):** Başka raporlar da kullanabilir (ör. Görev 56 KDV2 PDF'i).
  - **Masaüstü:** `renderer/fis-cikti.js` (`window.FisCikti`; Node'da `require` ile). Programdaki iki fiş ekranı bunu kullanıyor.
  - **Fatura Kontrol / Denetim / web sitesi:** `fk/fatura_kontrol/fis_cikti.py` (`ana_hesap_ozeti`, `fis_ek_html`, `FIS_EK_CSS`, `TDHP`).
  - Kullanım (JS): `fisEkHtml(anaHesapOzeti([{kod, borc, alacak}…], adBul))` ve stil `FIS_EK_CSS`; Excel için `fisEkAoa(özet)` satırları.
  - Kullanım (Python): `fis_ek_html(ana_hesap_ozeti([(kod, borç, alacak)…], ad_bul))` ve stil `FIS_EK_CSS`.
- **JS yardımcıları:**
  - `anaHesapOzeti(satırlar, adBul)`: Satırları ilk 3 haneye göre topluyor. Ana hesap adı önce firmanın hesap planından / mizanından, yoksa Tek Düzen hesap adından geliyor. Toplam borç, toplam alacak, denklik ve "özet gösterilsin mi" (aynı ana hesap birden çok satırda) bilgisini veriyor.
  - `fisEkHtml(özet)`: PDF için özet tablosu (gerekiyorsa) ve imza alanları.
  - `fisEkAoa(özet)`: Excel için aynı satırlar (fiş satırlarının altına).
- **Fiş görünümü değişmedi:** Mevcut fiş tablosu aynen duruyor; ek yalnız altına geliyor.
- **Denklik:** Özetin toplam satırında "borç = alacak"; dengesizse kırmızı "fiş dengesiz (fark …)".
- **İmza alanları:** Üç sütun: Hazırlayan, Kontrol Eden, Onaylayan; her birinde Ad Soyad, Tarih, İmza boşluğu. Excel'de aynı başlıklar ve "Ad Soyad: / Tarih: / İmza:" satırları.
- **Python (`fk/fatura_kontrol/web/app.py`, yardımcılar `fis_cikti.py`'de):**
  - `/api/denetim/fis` yanıtına `ozet` (aynı ana hesap birden çok satırda mı) eklendi.
  - Yazdırma sayfasında eski "Ana hesaplar görünümü" her fişte çıkıyordu; artık yalnız `ozet` doğruysa "Ana hesap özeti" olarak ve denklik bilgisiyle çıkıyor.
  - İmza alanı iki sütundan (Hazırlayan / Onaylayan) üç sütuna çıkarıldı.
  - Muhasebe Denetimi'nin ekrandaki fiş penceresindeki "Ana hesaplar görünümü" (yazdırma değil) değiştirilmedi.

## Testler
| Test | Sonuç |
|---|---|
| `node --test test/fis-ozet.test.js` (yeni) | 4/4 |
| `fk/tests/test_fis_ozet.py` (yeni) | 4/4 |
| `cd fk && pytest` | 228 geçti, 2 atlandı |
| `node --test web/denetim/kopru.test.mjs` | 9/9 |
| `test/luca/*.js` | 15 dosya geçti |
| `node test/mobil.js` | 45/45 |
| `xvfb-run -a node test/e2e.js` (main `8e87e6e` üstünde) | **380 geçti, 0 başarısız** |

- **Birim (`test/fis-ozet.test.js`):** Uygulamadaki yardımcıların kendisi sınanıyor. Sürüm iş akışına (`surum.yml`) eklendi.
  - Üç 102 satırı (`102.01`, `102.02`, `102.05.001`) tek "102 Bankalar" satırında toplanıyor; borç = alacak.
  - Hesap planındaki ad Tek Düzen adından önce geliyor.
  - Dengesiz fişte "fiş dengesiz (fark 10,00)" PDF ve Excel'de.
  - 153, 191, 320 birer kez → özet yok, imza alanları var.
  - İki 770 + bir 191 + bir 320 → özet var.
- **Python (`test_fis_ozet.py`):** Ortak modül doğrudan; yazdırma sayfasında üç 102 tek satır, denklik, dengesiz fark, özetsiz fişte üç imza alanı. `test_denetim.py`'deki mevcut fiş (her ana hesap bir kez) artık özetsiz, üç imza alanlı.
- **e2e:** Muavindeki fiş penceresinde PDF ve Excel'e basılıyor; üretilen sayfa ve Excel okunuyor. İmza alanları fiş toplamının altında. Örnek fişte aynı ana hesap tekrar ettiği için özet var. Test, özetin yalnız tekrar varken bulunduğunu da denetliyor.

## Kullanıcının deneyeceği adımlar
Yeni derlemeden sonra.
1. **Muavin fişi:** Mizan / Muavin / Hesap Planı › Muavin › bir fiş no › PDF. Aynı ana hesaptan birden çok satır olan bir fiş (ör. birkaç 770 satırı ya da birkaç banka) seçilirse fişin altında "Ana hesap özeti" ve "borç = alacak" görünmeli; en altta üç imza alanı.
2. **Tek satırlı ana hesaplar:** 153 / 191 / 320 gibi birer satırlı bir alış fişinde özet olmamalı, imza alanları olmalı.
3. **Excel:** Aynı fişte Excel; fiş satırlarının altında aynı özet ve imza satırları.
4. **Fiş Listesi ve Fatura Kontrol / Denetim fiş penceresi:** Aynı kontroller.

## Açık konular
- **Ekrandaki denetim fiş penceresi:** Muhasebe Denetimi'nde fişi ekranda gösteren pencere her fişte "Ana hesaplar görünümü"nü göstermeye devam ediyor (yalnız çıktılar değişti). İstenirse aynı kurala bağlanabilir.
- **İmzacı adları:** Alanlar boş bırakılıyor (elle doldurulacak). Hazırlayan adının kullanıcı adından otomatik yazılması istenirse eklenebilir.
