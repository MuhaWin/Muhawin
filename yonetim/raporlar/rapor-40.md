# Rapor 40 – Muavinde cari hesapların yanlış okunması

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `9995260` · **Dal:** `claude/awesome-ritchie-ftviuk`
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı. Hata sahte muavinle yeniden üretildi; müşteri verisi kullanılmadı.

## Belirtiler (kullanıcı, 2.9.13 deneme sürümü)
1. **Fiş farklı:** Muavinde fiş numarasına basınca açılan fiş Luca'dakiyle aynı değil.
2. **Cariler tek hesapta:** Bazı firmalarda (Innocap) fişlerdeki bütün cari satırları tek bir hesapta, "302…"de görünüyor. Gider ve KDV satırları doğru.
3. **Cari muavini boş:** Hesap planı / muavinde 102'nin muavini geliyor, cari alt hesaplarınki boş.
4. **Kayıtta yanlış cari:** Kullanıcıya göre fiş oluştururken de cariler yanlış hesaba gidiyor.

## Kök neden
**Nerede:** `fk/fatura_kontrol/muavin_okuyucu.py` muavindeki hesap başlığını (`"320.01.001 SATICI A"`) şu kalıpla tanıyordu:

```
HESAP_RE = ^(\d{3}(?:\.\d+)*)\s+(.*)$      → alt gruplar YALNIZ rakam
```

**Neden yanlış:**
- Programın kendisi (cari açma, `HESAP.cariKodu`) **harfli cari düzenini** destekliyor: `320.P.0006`, `120.Ş.001` ("P harfi ile başlayan firmalar" grupları). Luca'da da bu düzen yaygın.
- Böyle bir başlık (`"320.P.0006 PETROL OFİSİ"`) tanınmıyordu. Okuyucu, tanımadığı başlığı geçip satırları **en son tanıdığı hesaba** yazıyordu.
- Luca muavini hesap koduna göre sıralı olduğu için harfli 320 carilerinden hemen önceki hesap çoğu zaman 302 (ör. 302.01). Bu yüzden **bütün harfli carilerin hareketleri 302'ye** gidiyordu.
- Rakamlı cari kodları (`320.01.0302`) doğru okunuyordu; sorun yalnız harf içeren kodlarda. Belirtinin "bazı firmalarda" görülmesi de buradan.

**Yeniden üretim** (eski okuyucu, sahte muavin):

| Muavindeki başlık | Hareket | Eski okuyucu | Yeni okuyucu |
|---|---|---|---|
| `302.01 ERTELENMİŞ …` | fiş 5 | 302.01 | 302.01 |
| `320.P.0006 PETROL OFİSİ A.Ş.` | fiş 6 | **302.01** | 320.P.0006 |
| `320.Ş.0001 ŞAHİN LTD` | fiş 7 | **302.01** | 320.Ş.0001 |
| `320.01.0302 ACME` | fiş 8 | 320.01.0302 | 320.01.0302 |

**Belirtilerle bağı:**
1. **Fiş farklı:** Muavinden kurulan fiş satırları muavindeki hesap koduyla kurulduğundan cari satırları 302'de görünüyordu.
2. **Hep 302:** Harfli carilerin hepsi aynı önceki hesaba yazılıyordu.
3. **Cari muavini boş:** `320.P.0006` kodlu hiçbir satır yoktu. 102 gibi rakamlı hesaplar doğruydu.
4. **Kayıtta yanlış cari:** "Faturaları Luca'ya kaydet" geçmişi muavinden öğreniyor. Aynı satıcının önceki faturası 302'de göründüğü için doğru cari öğrenilemiyordu. Daha önce eklenen "geçmişte cari diye 302 öğrenilmişse kullanma" koruması bu belirtiyi gizliyordu; kök neden bu.

**İncelenen ve sorun bulunmayan yerler:**
- **Luca'dan muavin çekme:** Hesap aralığı 100–999. Harfli alt hesaplar dosyada var; satırlar 302'ye düştüğüne göre indiriliyorlar. Değişiklik gerekmedi.
- **Muavin ekranında hesap süzme:** Kod birebir karşılaştırılıyor. Okuma düzelince dolu geliyor.
- **Muavinden fiş kurma:** Fiş numarasına göre gruplanıyor. Okuma düzelince satırlar Luca'daki gibi.

## Düzeltme
- **`muavin_okuyucu.py` – kod kalıbı:** Hesap kodunun alt grupları rakam **ya da harf** olabiliyor (`HESAP_RE` ve kod / ad ayrı hücrede olduğundaki `_KOD_RE`).
  - Türkçe harfler dahil, büyük / küçük: `320.P.0006`, `320.Ş.0012`, `320.ğ.0002`, `120.İ.0005`, `320.01.P.12`, `320.02.001.0007`.
- **`muavin_okuyucu.py` – açıklama satırı koruması (yöneticinin uyarısı):**
  - Tarihsiz bir açıklama satırı yalnız 3 haneli kodla başlıyorsa ve devamı küçük harfle ya da "no / nolu / numaralı / adet / tl / tane" ile başlıyorsa hesap başlığı **sayılmıyor**. Örnekler: "320 nolu fatura iptal edildi", "320 NOLU FATURA", "100 adet koli".
  - Eski okuyucu bu satırları da başlık sanıyordu; artık satırlar doğru hesapta kalıyor. "320 SATICILAR" gibi kebir başlıkları yine tanınıyor.
- **Aynı kökten küçük düzeltmeler** (Türkçe harfli kodlar reddediliyordu):
  - `renderer/app.js`: Hesap Planı "Excel'den Yükle" `320.Ş.0001` gibi kodları atlıyordu; yeni hesap formu "Kod biçimi geçersiz" diyordu.
  - `luca.js`: Luca'nın döndürdüğü hesap kodu ve KDV kod tablosu kodlarında aynı denetim.

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_muavin_harfli_cari.py` (yeni) | 3/3 · **eski okuyucuyla 2 test kırılıyor, yenisiyle geçiyor** |
| `cd fk && pytest` | 176 geçti, 1 atlandı |
| `node --test web/denetim/kopru.test.mjs` | 5/5 |
| `test/luca/*.js` | 13 dosya geçti |
| `xvfb-run -a node test/e2e.js` | **350 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

`test_muavin_harfli_cari.py`:
- **Sahte muavin:**
  - 14 farklı cari: harfli, Türkçe harfli (büyük / küçük), baştaki sıfırlı (`320.01.0302`), 3–4 seviyeli, karışık seviyeli (`320.01.P.12`), 120 müşteri.
  - Hesaplar Luca sırasıyla, 302.01 carilerden hemen önce.
  - Başlık iki biçimde: kod ve ad aynı hücrede ya da ayrı hücrelerde.
- **Doğrulananlar:**
  - Her carinin hareketi kendi kodunda; 302.01'de yalnız kendi satırı var.
  - **Muavinden kurulan her fiş beklenen fişle satır satır aynı** (hesap kodu, borç, alacak).
- **API'den (`/api/muavin`, muavin ekranının verisi):** `320.P.0006`'nın muavini dolu, 302'de cari satırı yok.
- **Kayıt ekranının geçmişi:** Aynı VKN'li önceki fatura `320.P.0006`'ya kaydedilmiş. Kayıtsız faturaya cari olarak `320.P.0006` öneriliyor (302 değil).
- **Açıklama satırları:** "320 nolu …", "100 adet …" hesabı değiştirmiyor; "320 SATICILAR" başlık olarak tanınıyor.

## Kullanıcının deneyeceği adımlar (Innocap)
Program derlendikten sonra (derleme kullanıcı isteyince).
1. **Muavini yeniden çekin:** Innocap'ta Mizan / Muavin / Hesap Planı → "Tümünü Luca'dan Çek". Okuma kayıtlı dosyadan yeniden yapılıyor; yalnız programı güncellemek de yeterli.
2. **Cari muavini:** Hesap planında bir cari alt hesaba (ör. `320.P…`) girin. Muavin dolu gelmeli.
3. **Fiş:** Muavinde bir alış fişinin numarasına basın. Cari satırı Luca'daki fişle aynı hesapta (302 değil) olmalı.
4. **Kayıt ekranı:** "Faturaları Luca'ya kaydet"te aynı satıcının yeni faturasına doğru cari önerilmeli.
5. **Hâlâ farklılık varsa:** O ayın muavin Excel'ini (adlar karartılabilir) ve ilgili fişin Luca ekran görüntüsünü gönderin.

## Açık konular
- **Gerçek dosyayla doğrulama:** Kök neden sahte dosyayla yeniden üretildi ve belirtilerin hepsini açıklıyor. Innocap'ın gerçek muavin dosyası görülmedi; hesap kodlarının harfli olduğu varsayılıyor. Başka bir biçim farkı varsa yukarıdaki 5. adımdaki örnek gerekir.
- **Küçük harfle başlayan kebir başlığı:** "770 genel yönetim giderleri" gibi küçük harfle başlayan 3 haneli kebir başlığı artık başlık sayılmaz. Luca hareketleri alt hesaplarda tuttuğu ve adlar büyük harfle başladığı için olası değil.
