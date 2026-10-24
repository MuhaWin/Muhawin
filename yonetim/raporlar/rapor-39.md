# Rapor 39 – Fiş önizlemesinde satır ekle / çıkar

**Durum:** Yapıldı. Fiş önizlemesi olan tüm bölümlerde düzeltildi: Belgeden Fiş (ÖKC fişi, Z raporu, yurt dışı faturası; üçü aynı önizlemeyi kullanıyor) ve **Faturaları Luca'ya kaydet (FKAYIT)**. İşçi oturumu: **Menü Düzenleme**. Taban: `main` (Görev 34 #65 ve Görev 37 #66 birleştikten sonra).

## 1. "Satır ekle" neden çalışmıyordu
- **Kök neden:**
  - "＋ Satır ekle" belgeye boş bir satır ekliyordu: hesap yok, tutar 0.
  - Fiş satırlarını üreten `satirlar()` ise hesabı ve tutarı olmayan eklenmiş satırı **atlıyordu** (`if(!bb&&!cc&&!x.acc)continue`).
  - Satır veride vardı ama önizlemede hiç çizilmiyordu. Kullanıcının yazacağı kutu çıkmadığı için düğme "çalışmıyor" görünüyordu.
- **Düzeltme:**
  - Boş eklenen satır artık önizlemede görünüyor (`bosEk`): hesap kodu (hesap planı önerili liste), açıklama, borç ve alacak kutularıyla.
  - Hesap ya da tutar girilene kadar fişe yazılmıyor ve hata da vermiyor.
  - Girildiği anda fişe giriyor ve denge yeniden hesaplanıyor:
    - ÖKC fişi ve yurt dışı faturada ödeme satırı dengeliyor (eskisi gibi).
    - Z raporunda kasa (nakit) satırı dengeliyor (yeni; ayrıntısı aşağıda).
- **Ortak mı:** Belgeden Fiş'in üç bölümü aynı `satirlar()` ve aynı önizleme kodunu kullanıyor; düzeltme tek yerde. FKAYIT ayrı kodda aynı hata kalıbını taşıyordu; orada da aynı biçimde düzeltildi (aşağıda).

## 2. "−" (çıkar) düğmesi
- Her satırın yanında **−** düğmesi var.
- **Otomatik satır** (gider, KDV, stopaj, kredi kartı …):
  - − ile fişten çıkıyor; tablonun altında **soluk** gösteriliyor, yanında "fişten çıkarıldı" etiketi ve **↺ Geri ekle** düğmesi var.
  - Geri alma yöntemi olarak bunu seçtim. Kısa ömürlü bir bildirime göre basit ve kalıcı: satır kaybolmuyor, istenince geri eklenebiliyor.
- **Elle eklenen satır:** − ile tamamen siliniyor (kullanıcının kendi eklediği satır; yeniden "＋ Satır ekle" ile eklenir).
- **0 yazmak artık satırı çıkarmıyor:** Bir satırın iki tarafı da 0 yapılırsa önerilen tutara dönülüyor ve "0 yazınca satır çıkmaz … − düğmesine basın" bildirimi çıkıyor.
- **Geriye uyumluluk:** Eski sürümde 0 yazılarak çıkarılmış satırlar (kayıtta `{b:0,c:0}`) "çıkarılmış" sayılıyor; soluk görünüyor ve Geri ekle ile döndürülebiliyor. Yeni çıkarmalar `{cikar:true}` ile tutuluyor.
- **Açıklama metni:** "0 yazarsanız satır fişten çıkar" yerine artık "Tutarı değiştirmek için kutuya yazın; satırı çıkarmak için yanındaki − düğmesine basın."

### Z raporu dengesi
- **Önceki durum:** Kasa satırı sabitti (toplam − kredi kartı). Satır eklenince ya da çıkarılınca fiş dengesiz kalıyordu.
- **Yeni durum:** Kasa satırı fişi dengeliyor: alacaklar − öteki borçlar.
- **Değişmeyen:** Eklenen satır yokken sonuç eskisiyle birebir aynı; mevcut "Z raporu fişi" e2e denetimi aynen geçiyor. Satır sırası da korunuyor (kasa, kredi kartından sonra).

## 3. Görev 18 taramasında neden yakalanmadı
- Tarama bir düğmeyi şu durumlarda "etkisiz" sayıyordu: tıklanınca DOM değişmezse ve ana sürece çağrı gitmezse.
- "＋ Satır ekle" belgeyi kaydedip tabloyu yeniden çiziyordu. Yeniden çizim **DOM değişikliği** sayıldığı için düğme "sorunsuz" görünüyordu.
- Tarama, tıklamadan sonra **beklenen satırın ekranda belirdiğine** bakmıyordu. Ayrıca fiş önizlemesi yalnız belge varken ve "Fiş" açıkken görünüyor; tarama böyle bir belge hazırlamıyordu.
- Bu tür "veride oldu ama ekranda yok" hataları için yeni e2e denetimi sonucu ekranda ölçüyor.

## FKAYIT (Faturaları Luca'ya kaydet)
- Yönetici onayıyla, Görev 34 birleştikten sonra `main` üzerine uygulandı.
- Aynı kök neden: fatura fişini üreten `satirlar(r)` boş eklenen satırı atlıyordu. Düzeltme Belgeden Fiş'le aynı:
  - boş eklenen satır görünüyor (`bosEk`), hesap / tutar girilince fişe giriyor; cari satırı fişi yeniden dengeliyor
  - otomatik satırlarda **−** (`data-fcikar`, kayıtta `{cikar:true}`), çıkarılan satır soluk ve **↺ Geri ekle** (`data-fgeri`)
  - eklenen satırda ✕ yerine **−**
  - 0 yazmak satırı çıkarmıyor; önerilen tutara dönülüyor ve bildirim çıkıyor; eski `{b:0,c:0}` kayıtları "çıkarılmış" sayılıyor
  - açıklama metni Belgeden Fiş'le aynı
- Kaydedilmiş (Luca'ya gönderilmiş) faturada düğmeler çıkmıyor (eskisi gibi salt okunur).

## Değişen dosyalar
- `renderer/app.js`:
  - Belgeden Fiş `satirlar()`: `cikan` ve `bosEk` listeleri, Z kasa dengesi; önizleme: −, Geri ekle, açıklama; olaylar: `data-okccikar`, `data-okcgeri`, 0 kuralı
  - FKAYIT `satirlar(r)`: `cikan` ve `bosEk`; fiş tablosu: −, Geri ekle, açıklama; olaylar: `data-fcikar`, `data-fgeri`, 0 kuralı
- `renderer/style.css`: `.fiscikar`, `tr.fiscikan`
- `test/e2e.js`: iki yeni denetim (Belgeden Fiş üç bölüm, FKAYIT)
- `yonetim/raporlar/rapor-39.md`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **331 ✓, 0 başarısız** (`main`, Görev 34, 37 ve 36 birleştirildikten sonra).
- `node test/mobil.js`: **45/45.**
- **Yeni e2e denetimi**, Z raporu, ÖKC fişi, yurt dışı fatura ve FKAYIT fatura fişi için ayrı ayrı (FKAYIT'te hesap 770.01, borç 10,00; cari 600 → 610 → 600, − ile gider çıkınca 100). Her adımda ekrandaki eklenen / çıkarılan satır sayısı ve fiş dengesi ölçülüyor:
  1. ＋ Satır ekle → boş satır ekranda görünüyor, fişe girmiyor
  2. hesap (770.01) ve borç (12,50) yazılıyor → satır fişte, denge eşit
  3. − ile eklenen satır siliniyor
  4. − ile ilk otomatik satır çıkıyor → soluk satır görünüyor, denge eşit
  5. ↺ Geri ekle → satır geri geliyor
  6. tutar kutusuna 0 yazılıyor → satır çıkmıyor
