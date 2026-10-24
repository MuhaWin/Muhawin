# Rapor 35 – VKN/TCKN ve fatura seri ön ekiyle cari eşleştirme

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `95fa171` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya / GİB'e istek yapılmadı. Testlerde sahte fatura ve muavin kullanıldı, müşteri verisi yok.

## Yapılanlar
| # | İstek | Çözüm |
|---|---|---|
| 1 | Yeni cari dışa aktarımında VKN/TCKN; yerel cari kaydında VKN/TCKN | **Yerel kayıt yapıldı, dışa aktarım ve Luca'ya gönderim açık konu** (yönetici onayıyla; aşağıda) |
| 2 | Öncelik: VKN/TCKN kesin → ünvan; çakışmada VKN, uyarıyla; geçersiz numara kullanılmaz | "Faturaları Luca'ya kaydet"te cari önerisi bu sırayla. Ayrıntı aşağıda |
| 3 | Fatura no ön eki destekleyici sinyal | Ön ek → kullanan firma sayısı hesaplanıyor. Ön ek yalnız tek firmanınsa, genel değilse (GIB, EAR, EFT) ve muavinde tek cariye kaydedilmişse kullanılıyor |
| 4 | Testler | Aşağıda |

### 1. Yerel kayıt ve açık konu
- **Firmada VKN/TCKN → cari kodu (`firm.cariVkn`).** Şu durumlarda yazılıyor:
  - fatura Luca'ya kaydedilince
  - "Eksik carileri aç"ta cari Luca'da VKN ile bulununca
  - cari Luca'da açılınca
- **Sağlamasız numara yazılmıyor:** Sağlaması tutmayan VKN/TCKN, cari olmayan hesap ve henüz açılmamış taslak cari yazılmıyor.
- **Yeni cari taslağı:** VKN'yi zaten tutuyordu (`HESAP` taslağı, `vkn` alanı). Değişmedi.
- **Açık konu:**
  - Programda "yeni cari Excel hesap planı" dışa aktarımı yok. Yeni cariler Luca'ya `addHesapPlaniAction.do` ile açılıyor; formda yalnız kod, ad, düzey ve aktiflik gidiyor.
  - Luca'nın hesap planı Excel aktarım şablonunun sütunları ve cari açma formunun VKN/TCKN alan adları doğrulanmış değil. `yonetim/belgeler/luca-hesap-plani-kesif.md`: "Excel sütunları gerçek dosyayla teyit edilmedi". Bilinen tek şey, `hesapPlaniSearchAction.do` aramasında `tcNo` / `vergiNo` alanlarının olması (programda VKN ile cari arama bunu kullanıyor).
  - Uydurmamak için yapılmadı. Yönetici kullanıcıdan İstek Kaydı'nı ya da şablonu isteyecek.

### 2. Eşleştirme sırası (`FKAYIT.cariSec`)
1. **Kural** (kullanıcının yazdığı cari) – eskisi gibi en önde.
2. **VKN/TCKN (kesin):**
   - Önce firmada hatırlanan VKN → cari.
   - Sonra muavinden öğrenilen geçmiş: aynı VKN'li faturaların kaydedildiği cari.
   - Fatura Kontrol bu geçmişin VKN ile mi ünvanla mı bulunduğunu artık `gecmis.eslesme` ile bildiriyor.
   - Satırda **"VKN"** çipi görünüyor.
3. **Ünvan:** Görev 22 kuralları (`cariBul`) ya da ünvanla öğrenilmiş geçmiş.
4. **Fatura no ön eki:** Yalnız ünvan da bulamazsa ve ön ek güçlüyse. Çip "ön ek", uyarı "kontrol edin".

**Uyarılar** (cari hücresinin altında, turuncu):
- **VKN ile ünvan farklı cariyi gösteriyor:** "VKN 1234567890 ile 320.01.101 bulundu; ünvan 320.01.102 carisine benziyor — VKN esas alındı, kontrol edin".
- **Geçersiz numara:** "VKN/TCKN 1234567891 geçersiz (sağlama tutmuyor): eşleştirmede kullanılmadı". Bu durumda ünvana geçiliyor.
- **Ön ek ile ünvan çelişiyor:** Ünvan geçerli, uyarı veriliyor. Aynı cariyi gösteriyorlarsa çip "ünvan + ön ek".
- **Elle seçilen cari:** Çip ve uyarı gösterilmiyor; elle seçim hiçbir kaynakla değişmiyor.

**Numaralar:**
- **VKN:** 10 hane, GİB sağlaması.
- **TCKN:** 11 hane, ilk hane 0 değil, 10. ve 11. hane sağlaması.
- **9 haneli numara:** Baştaki 0 düşmüş sayılıyor ve 10 haneye tamamlanıyor (Luca e-Belge listesindeki sayı biçimi için).
- **Aynı denetim iki yerde:** Python (`fk/fatura_kontrol/vkn.py`) ve ekran (`vknOk`). 6000 rastgele numarada iki uygulama aynı sonucu verdi.

### 3. Ön ek
- **Ön ek:** 16 karakterlik GİB numarasının ilk 3 karakteri (`ABC2026000000001` → `ABC`); başka biçimde ön ek yok.
- **İstatistik:** Firmanın bütün dönem klasörlerindeki faturalardan ön ek → kullanan karşı taraf (VKN) sayısı. Muavinde kayıtlı faturalardan ön ek → cari hesap.
- **Güçlü sayılma koşulu:**
  - ön ek genel değil (GIB, EAR, EFT)
  - yalnız bir karşı taraf kullanmış
  - muavinde tek bir cariye kaydedilmiş
- **Kullanım:** Tek başına yalnız VKN ve ünvan sonuç vermezse kullanılıyor; öteki durumlarda ünvanı destekliyor ya da çelişkiyi bildiriyor.
- **Luca e-Belge listesi:** Görev metnindeki `gib530/fatura_list.jq` (alış 68 ayrı ön ek) bu görevde **kullanılmadı**. Ön ek istatistiği programın elindeki faturalardan (Luca'dan ya da GİB'den indirilen dönem arşivleri) hesaplanıyor. Uç resmi olmadığı için ek istek eklenmedi. Gerekirse ayrı görev olarak yalnız okuma amaçlı eklenebilir.

### Değişen dosyalar
- `fk/fatura_kontrol/vkn.py` (yeni): `vkn_norm`, `gecerli`, `onek`, `GENEL_ONEKLER`.
- `fk/fatura_kontrol/kayit_aday.py`:
  - `ogren` ön ek istatistiği (`ogren.onek`).
  - Adaylarda her faturaya `vkn_gecerli`, `onek`, `gecmis.eslesme` (vkn / unvan / kelime).
  - Öteki alanlar aynı.
- `renderer/app.js` (`FKAYIT`): `vknN`, `vknOk`, `cariSec`, `cariVknHatirla`, `oner` cari bölümü, cari hücresinde çip / uyarı (`cariNot`).
- `fk/tests/test_cari_vkn.py` (yeni), `test/e2e.js` (Görev 35 bölümü).

## Testler
| Test | Sonuç |
|---|---|
| `pytest fk/tests/test_cari_vkn.py` (yeni) | 3/3 |
| `cd fk && pytest` (tümü) | 171 geçti, 1 atlandı |
| `node --test web/denetim/kopru.test.mjs` (site paketi `tools/site_uret.js --denetim` ile üretildi) | 5/5 |
| `test/luca/*.js` (13 dosya) | hepsi geçti |
| `xvfb-run -a node test/e2e.js` | **347 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

`test_cari_vkn.py`:
- **Sağlama:** VKN / TCKN doğru ve yanlış örnekler, 9 haneli tamamlama, ön ek biçimi.
- **Kayıt adayları** (sahte muavin + 6 UBL, API üzerinden):
  - **Aynı VKN, farklı ünvan:** geçmiş VKN ile bulunuyor (`eslesme: vkn`, `320.01.001`).
  - **`ABC` ön eki:** tek firma, tek cari → güçlü.
  - **Geçersiz VKN:** `vkn_gecerli: false`; `GIB` genel ön ek cari göstermiyor.
  - **`XYZ` ön eki:** iki firma kullanmış → güçlü değil; TCKN geçerli.

e2e Görev 35 bölümü:
- **VKN – ünvan çakışması:** VKN esas, uyarı veriliyor.
- **Geçersiz VKN:** kullanılmıyor, uyarı veriliyor; TCKN sağlaması doğru.
- **Hatırlanan VKN:** firmada hatırlanan VKN kesin eşleşme oluyor.
- **Geçersiz VKN'de ünvan:** eşleşme ünvanla yapılıyor.
- **Ön ek:**
  - Yalnız güçlü ön ekle bulunan cari uyarıyla geliyor.
  - Ön ek ünvanla aynıysa destekliyor, farklıysa uyarıyor.
  - Genel ön ek (GIB) cari göstermiyor.
- **Hatırlama:** Yalnız geçerli VKN/TCKN ve cari hesap hatırlanıyor.
- **Ekranda:** "VKN" çipi ve çakışma uyarısı görünüyor (`rapor-35/cari-vkn.png`).

## Kullanıcının deneyeceği adımlar
Program derlendikten sonra (derleme kullanıcı isteyince).
1. **VKN ile bulma:** Bir firmanın "Faturaları Luca'ya kaydet" ekranını açın. Daha önce kaydedilmiş satıcıların faturalarında cari altında **"VKN"** çipi görünmeli. Ünvan farklı yazılmış olsa da (ör. "A.Ş." / "ANONİM ŞİRKETİ") doğru cari gelmeli.
2. **Çakışma uyarısı:** Ünvanı başka bir cariye benzeyen bir faturada turuncu "VKN esas alındı, kontrol edin" uyarısı çıkmalı.
3. **Hatırlama:** Bir faturayı Luca'ya kaydedin; aynı satıcının sonraki faturasında cari "VKN" ile gelmeli.
4. **Geçersiz numara:** Vergi numarası hatalı bir faturada "geçersiz (sağlama tutmuyor)" uyarısı görünmeli.

## Riskler ve açık konular
- **Madde 1:** Luca'ya VKN gönderimi ve hesap planı Excel şablonu doğrulanınca yapılacak.
- **Genel ön ek listesi:** Yalnız görev metnindeki GIB, EAR, EFT. Asıl koruma "ön eki yalnız bir firma kullanmış" koşulu; başka genel ön ekler zaten birden çok firmada göründüğü için güçlü sayılmaz.
- **Hatırlanan eşleşmenin önceliği:** Elle yanlış seçilip Luca'ya kaydedilen cari, firmada o VKN için hatırlanır ve sonraki faturalarda VKN eşleşmesi olarak gelir. Doğru cariyle yeniden kaydetmek hatırlananı değiştirir.
