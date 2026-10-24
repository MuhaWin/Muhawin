# Rapor 36 – "Faturaları Luca'ya kaydet": kod tanımlamaları

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `971aba7` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı; Luca isteği taklit pencereyle, ekran sahte veriyle sınandı. Müşteri verisi yok.

## Yapılanlar
| # | İstek | Çözüm |
|---|---|---|
| A | "Alış kod tanımları" / "Satış kod tanımları" | Araç çubuğunda iki düğme. Her biri **firma başına** bir tablo açıyor: satırlar işlem türü, sütunlar KDV oranı (%0, 1, 8, 10, 18, 20), hücre hesap kodu. Tablo firmada saklanıyor (`firm.fkKod`). Alış faturaları alış, satış faturaları satış tablosuna göre dolduruluyor |
| A | Elle doldurma | Hücreler hesap planı listesinden öneriyle yazılıyor. Kaydederken planda olmayan ya da ana hesap olan kod **reddediliyor**, hangi hücre olduğu yazıyor (hesap açılmıyor). Elle yazılan hücre "elle" çipiyle işaretli |
| A | "Luca'dan çek" | `POST /Luca/kdv/kdv_hesap_listesi.jq` `{"map":1,"oranlar":"0,1,8,10,18,20","islemler":"0,1,2,3,4,11,20,50"}`. Yanıt `KDV_<oran>_<işlem>` → `{hesap_kodu, hesap_adi, hesap_id}` ayrıştırılıyor. İstek Görev 29 iş kilidiyle (`isle`, firma seçilerek) gidiyor. Gelen hücreler "Luca" çipiyle görünüyor |
| A | Elle hücre ezilmez | Elle hücre Luca'dan çekince değişmiyor. Luca'daki farklıysa farklar listelenip soruluyor: "Luca'dakini kullan" denirse değişiyor, "Vazgeç"te elle değer kalıyor. Kayıt "Kaydet ve uygula" ile |
| B | Doldurma kaynağı | Araç çubuğunda **"Doldurma"** seçimi: "Kural → geçmiş → varsayılan" (mevcut) ya da **"Kural → kod tablosuna göre"**. Firmada hatırlanıyor |
| B | Satırda [Kod] [Geçmiş] [Kural] | Hesap sütununda üç küçük düğme. Basılı olan kullanılan kaynak; satırda ayrıca kaynak çipi ("kod tablosu", "geçmiş", "kural"). Kaynağı olmayan düğme kapalı, ipucu nedenini söylüyor (ör. "Geçmiş kayıt yok") |
| C | Kuralda ana hesap | Kural hesabı **ana hesapsa** (noktasız kod, ör. 153; ya da planda alt hesabı olan kod) detay hesap kod tablosundan, faturanın KDV oranına göre seçiliyor (%1 → 153.01.01, %10 → 153.01.10, %20 → 153.01.20). **Detay hesap** yazılmışsa o kullanılıyor. Kural penceresinde hesap kutusunun altında: "Ana hesap yazarsanız detay hesap kod tablosundan seçilir; detay hesap yazarsanız sizin yazdığınız geçerli olur." Satırda "ana 153 → kod tablosu" notu |
| C | Oran boşsa uyarı | Kod tablosunda o oran için ana hesabın altında hesap yoksa hesap **boş kalıyor**, satırda ve fişte açık hata: "Kuralda ana hesap 153 yazılı; Alış kod tanımlarında %18 KDV oranı için 153 altında hesap yok. Kod tanımlarını doldurun ya da kurala detay hesap yazın." Fatura bu durumda Luca'ya gönderilemiyor (hesap boş) |
| D | Testler | Aşağıda |

## Ayrıntılar
### İşlem türleri ve tablolar
- **Alış tablosu** (gelen faturalar): 11 Ticari mal alışı (matrah) · 1 İndirilecek KDV · 50 Satıştan iadeler (müşterinin kestiği iade faturası, matrah) · 4 Satıştan iade KDV.
- **Satış tablosu** (kesilen faturalar): 0 Yurtiçi satışlar (matrah) · 3 Hesaplanan KDV · 20 Alıştan iade (satıcıya kesilen iade faturası, matrah) · 2 Alış iadesi KDV.
- **Neden iadeler bu tablolarda:** "Alış faturaları alış tablosuna" kuralı korunsun diye işlemler faturanın geldiği yöne göre dağıtıldı. Gelen iade faturası satıştan iadedir (610 + 191), kesilen iade faturası alıştan iadedir (153 + 391).
- **Kullanılmayan kodlar:** 9998 / 9999 (KKEG) istenmedi; anlamı doğrulanmadığı için tabloya konmadı.
- **Doğrulanmayan:** Diğer işlem kodlarının anlamı Luca'da doğrulanmadı, uydurulmadı. Yalnız görev metnindeki 8 kod kullanıldı.

### Hangi hesap nereden
- **Matrah hesabı:** Faturanın en büyük matrahlı KDV oranının sütunundan alınıyor. Fişte matrah tek satır olduğu için çok oranlı faturada tek hesap seçiliyor.
- **KDV hesabı:** Her oran için kod tablosunun KDV satırından (1 / 3 / 4 / 2) alınıyor.
  - Satır "kod tablosu" kaynaklıysa önce kod tablosu.
  - Değilse sıra: o karşı tarafla geçmişte kullanılan → kod tablosu → eski öğrenme (muavinden) → hesap adındaki oran.
  - Komisyoncu faturalarında kod tablosu kullanılmıyor (mevcut 600 / 391 mantığı aynı).
- **Sıra (Doldurma = mevcut):** Kural → geçmiş → varsayılan → kod tablosu.
- **Sıra (Doldurma = kod tablosuna göre):** Kural → kod tablosu → geçmiş → varsayılan. "Hiç kaydetme" kuralı her durumda önce.
- **Elle yazılan hesap:** Hiçbir kaynak değiştirmiyor. Satırdaki bir kaynak düğmesine basılırsa o kaynağa dönüyor.

### Değişen dosyalar
- `luca.js`: `kdvHesaplari` (iş kilidiyle), `kdvTablosuCoz` (yanıt ayrıştırma); `main.js` / `preload.js`: `luca-kdv-hesaplari`.
- `renderer/app.js` (`FKAYIT`): kod tablosu yardımcıları (`KOD_ISLEM`, `kodBul`, `anaMi`, `detayHesap`, `kaynaklar`), `oner(f, zorla)`, `kdvHesap`, `kodTanim` penceresi, `kodBirlestir`, satır düğmeleri (`ksDugme`), kural penceresi notu, olaylar.
- `renderer/style.css`: satır düğmeleri.
- `test/luca/kdv-tablosu.js` (yeni), `test/e2e.js` (Görev 36 bölümü).
- Menü Düzenleme'nin Görev 39'da düzelteceği "Satır ekle" kodu (`satirlar` içindeki `ekSatir`) **değişmedi**. `satirlar`'a yalnız hesap boşken kod uyarısını yazan bir satır eklendi.

## Testler
| Test | Sonuç |
|---|---|
| `node test/luca/kdv-tablosu.js` (yeni) | **5/5** |
| `test/luca/*.js` (12 dosya) | hepsi geçti |
| `xvfb-run -a node test/e2e.js` | **327 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

`kdv-tablosu.js`:
- İstek firma seçildikten sonra gidiyor.
- Gövde `map:1`, oranlar ve işlemler `0,1,2,3,4,11,20,50`.
- `KDV_20_11` → `{11: {20: {kod, ad}}}`; geçersiz anahtar / boş hesap atlanıyor.
- Nesne olmayan yanıt "FORMAT" hatası veriyor.

e2e Görev 36 bölümü (sahte firma, taklit Luca yanıtı):
- **Tablo ve çekme:**
  - Alış kod tanımları alış tablosunu açıyor.
  - "Luca'dan çek"te elle yazılan %20 hücresi (153.01.99) Luca'dakinden (153.01.20) farklı → gösterip soruyor. "Vazgeç"te elle değer korunuyor, boş hücreler Luca'dan doluyor.
  - Planda olmayan hesap (999.99) kaydedilmiyor, uyarı veriyor.
  - Kayıt firmaya "elle" işaretiyle yazılıyor.
  - İkinci çekişte "Luca'dakini kullan" denince hücre değişiyor.
- **Kural:**
  - Kural penceresinde ana / detay açıklaması.
  - Ana hesap 153 + %20 → 153.01.99, %10 → 153.01.10.
  - Detay hesap yazılınca o kullanılıyor.
  - %18 boş → açık uyarı, hesap boş.
- **Doldurma:**
  - Mevcut sırada geçmiş, "kod tablosuna göre"de kod tablosu kullanılıyor; oran boşsa uyarı.
  - Kod tablosuyla doldurulan faturanın fişinde KDV de kod tablosundan (153.01.99 / 191.01.20 / 320.01).
- **Satır düğmeleri:**
  - [Kod] hesabı kod tablosundan alıyor, "kod tablosu" çipi çıkıyor.
  - [Geçmiş] geçmiş yokken kapalı.
  - [Kural] kural hesabına dönüyor.

Ekran görüntüsü: `rapor-36/satir.png` (satırda [Kod] [Geçmiş] [Kural], araç çubuğunda kod tanımları ve "Doldurma").

## Kullanıcının gerçek Luca'da deneyeceği adımlar
Program derlendikten sonra (derleme kullanıcı isteyince).
1. **Açılış:** Luca'ya bağlanın, bir firmanın "Faturaları Luca'ya kaydet" ekranını açın, **Alış kod tanımları**na basın.
2. **Luca'dan çek:** Tablo Luca'daki KDV hesap tanımlarıyla dolmalı (ör. Ticari mal alışı %20 → 153.01.20, İndirilecek KDV %20 → 191.01.20). Gelmeyen ya da yanlış hücre olursa ekran görüntüsünü gönderin.
3. **Elle hücre:** Bir hücreyi elle değiştirip kaydedin, yeniden "Luca'dan çek"e basın. Fark sorulmalı; "Vazgeç"te sizin yazdığınız kalmalı.
4. **Doldurma:** "Doldurma"da "Kural → kod tablosuna göre"yi seçin. Kuralı olmayan alış faturalarında hesap kod tablosundan gelmeli, satırda "kod tablosu" yazmalı. Bir satırda [Geçmiş] / [Kod] düğmelerini deneyin.
5. **Ana hesap kuralı:** Bir faturadan "Kural yap" deyip hesap olarak yalnız **153** yazın. %20 faturada 153.01.20, %10 faturada 153.01.10 seçilmeli. Kod tablosunda boş bir oranda (ör. %8) uyarı çıkmalı.

## Riskler ve açık konular
- **Luca ucu resmî değil:** `kdv_hesap_listesi.jq` Luca'nın kendi ekranının isteği. Yanıt biçimi değişirse "Luca'dan çek" "beklenmeyen yanıt" hatası verir. Elle doldurma çalışmaya devam eder.
- **İşlem kodları:** Yalnız görev metnindeki 8 kod kullanıldı. İhracat / istisna gibi başka işlemler gerekirse kodları Luca'da doğrulanınca eklenebilir.
- **Çok oranlı fatura:** Matrah tek satır olduğu için hesap en büyük matrahlı oranın hesabı. Oran başına ayrı matrah satırı istenirse ayrı görev.
- **Yerleşim:** Yeni düğmeler ve "Doldurma" seçimi araç çubuğuna eklendi; 1440 px genişlikte çubuk bir satır uzuyor (Görev 34'te kazanılan liste yüksekliğinden ~40 px). İstenirse iki kod düğmesi tek menüde toplanabilir.
- **Yorum:** "Doldurma kaynağı: mevcut seçenek" ekranda karşılığı olan bir seçim bulunamadığı için yeni "Doldurma" seçimi olarak yorumlandı (mevcut sıra varsayılan). Farklı bir yer kastedildiyse taşınabilir.
