# Rapor 50 – "Luca'ya kaydet" düğmesi pasif: nedeni

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `6881ebf` · **Dal:** `claude/awesome-ritchie-ftviuk`
Derleme yapılmadı. Testlerde sahte veri kullanıldı.

## Belirti (2.9.15 denemesi)
- Bir firmada 6 kayıtsız fatura vardı; hesap planı ve hesaplar dolu görünüyordu.
- "Luca'ya kaydet" düğmesi hiç açılmadı, aktarım yapılamadı.
- Kullanıcı mizan ve muavini yeni çekmişti. Sorusu: "Faturalar artık muavinde olduğu için mi?"

## Düğmenin pasif olduğu koşullar (eski kod)
| # | Koşul | Ekranda görünen |
|---|---|---|
| 1 | Seçili fatura yok | Hiçbir şey. Muavinde kayıtlı sayılan, programla kaydedilmiş ya da "kaydedilmeyecek" faturalar varsayılan olarak seçilmez; "Kayıtsız" sekmesinde görünmezler |
| 2 | **Seçili faturalardan herhangi birinde fiş eksiği var** | Yalnız küçük "Seçili: 6 · 1 eksik" yazısı ve o satırın Durum sütunundaki kırmızı ilk hata. **Bir faturanın eksiği bütün kaydı durdurur.** |
| 3 | Arka planda bir işlem sürüyor (kayıt, "Muavini Luca'dan çek") | Hiçbir şey |
| 4 | İşletme / serbest meslek defteri | Düğmenin ipucu (Excel kullanılıyor) |

**2. koşuldaki eksikler** (`satirlar` hataları):
- gider / gelir ya da cari hesabı boş
- KDV, tevkifat, ÖİV (689 / 950 / 951), binek KKEG hesabı bulunamadı
- ÖİV'li faturada hesapsız fark satırı (Görev 38)
- fiş dengesiz (elle tutar)
- kod tablosunda oran boş (Görev 36)
- eklenen satırda hesap yok
- dövizli faturada TL tutar yok

**Kullanıcının durumu için en olası neden:** 6 kayıtsız fatura listede görünüyorsa, varsayılan olarak seçili gelirler. Düğmenin hiç açılmaması için en olası neden 2. koşul: faturalardan en az birinde eksik var ve bu bütün kaydı durduruyor. Hesap sütunu dolu görünse de eksik çoğu zaman cari ya da KDV / ÖİV hesabında olur.

**"Muavinde olduğu için mi?" sorusu:** Bir fatura muavinde bulunursa "kayıtlı" sayılır. Bu durumda:
- "Kayıtsız" sekmesinden çıkar ve seçilmez (aynı faturayı iki kez kaydetmemek için).
- Altı fatura da muavine girdiyse liste boşalır ve düğme pasif kalır (1. koşul). Liste dolu görünüyorsa neden bu değildir.

Kullanıcı yeni sürümde nedeni artık ekranda görecek.

## Yapılanlar
1. **Nedeni düğmenin yanında** (`#fkkNeden`):
   - Görünüm: kırmızı "Kayıt yapılamıyor: …" kısa metni, `ⓘ` ve ipucunda bütün nedenler.
   - Kaydedilecek fatura yoksa sayılarıyla: "2 fatura muavinde zaten kayıtlı görünüyor", "N fatura MuhaWin ile kaydedildi", "N fatura kaydedilmeyecek".
   - Kayıtsız fatura var ama seçilmediyse: "Fatura seçilmedi: … kutusunu işaretleyin ya da Tümünü Seç".
   - Eksikler türüne göre sayılıyor, örneğin "2 seçili faturada eksik var: 2 faturada 'Cari hesabı seçin'".
   - Ötekiler: firmanın Luca karşılığı yok, işlem sürüyor.
2. **Eksikler için iki düğme:**
   - **Eksikleri göster:** Yalnız eksiği olan seçili faturalar listelenir; yeniden basınca hepsi.
   - **Eksikleri seçimden çıkar:** Eksikli faturalar seçimden çıkar, kalanlar hemen kaydedilebilir. Eksikli faturalar kayıtsız kalır; eksiği tamamlanınca seçilip kaydedilir.
3. **Muavinde kayıtlı fatura:**
   - Satırdaki çip artık "muavinde var · fiş N"; birden çok fişteyse ilk üçü.
   - Çipe basınca fiş muavinden açılıyor ("Luca fiş N" ile aynı pencere).
   - Fatura Kontrol, kayıt adaylarında her kayıtlı faturanın eşleştiği muavin fişlerini (no, tarih) veriyor.
4. **Luca karşılığı olmayan firma:** Düğme artık baştan pasif ve nedeni yazıyor. Eskiden basınca uyarı veriyordu.

## Değişen dosyalar
- `renderer/app.js` (`FKAYIT`):
  - `kayitEngelleri`, `nedenCiz`, `muavinCip`, `fisPencere` (Luca fişi penceresi ortaklaştı).
  - Eksik süzgeci (`st.hataF`) ve olaylar.
- `renderer/index.html`: `#fkkNeden`. `renderer/style.css`: yerleşim.
- `fk/fatura_kontrol/kayit_aday.py`: `muavin_fis`.
- Testler: `test/e2e.js` (Görev 50 bölümü), `fk/tests/test_program.py`.

## Testler
| Test | Sonuç |
|---|---|
| `xvfb-run -a node test/e2e.js` | **377 geçti, 0 başarısız** |
| `cd fk && pytest` | 214 geçti, 2 atlandı (kayıt adayları testi kararsızdı: firma VKN eşitliği; üçüncü satıcı eklendi) |
| `node test/mobil.js` | 45/45 |

e2e Görev 50 bölümü (sahte faturalar):
- **Kaydedilecek fatura yok:** İki fatura muavinde kayıtlı. Düğme pasif, neden yazıyor. Satırlarda "muavinde var · fiş 0012 / 0013"; çipten fiş penceresi açılıyor.
- **Fatura seçilmedi:** Neden yazıyor.
- **Eksikli seçim:** Üç seçili faturadan ikisinde cari boş.
  - Düğme pasif; ipucunda "2 faturada 'Cari hesabı seçin'".
  - "Eksikleri göster" yalnız ikisini gösteriyor.
  - "Eksikleri seçimden çıkar"dan sonra düğme açılıyor, neden kalkıyor.
- **Öteki koşullar:** Firmanın Luca karşılığı yok; işlem sürüyor.
- Ekran görüntüsü: `rapor-50/neden.png`.

## Kullanıcının deneyeceği adımlar
1. **Neden:** Aynı firmanın "Faturaları Luca'ya kaydet" ekranını açın. Düğme pasifse yanında "Kayıt yapılamıyor: …" yazmalı; ⓘ üzerine gelince bütün nedenler görünür.
2. **Eksik varsa:**
   - "Eksikleri göster" ile o faturaları açıp eksik hesabı tamamlayın.
   - Ya da "Eksikleri seçimden çıkar" deyip kalanları kaydedin.
3. **Faturalar muavinde kayıtlıysa:** "Tümü" sekmesinde "muavinde var · fiş N" çipine basıp fişi görün.
