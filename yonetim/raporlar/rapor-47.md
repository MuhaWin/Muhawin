# Rapor 47 – ESC veri girilen ekranlardan atmasın

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Görev 46 ile aynı PR. Derleme yok.

## Hata
- **Ne oluyordu:** "Faturaları Luca'ya kaydet" ekranında fiş kutusuna yazarken ESC'ye basınca ekran kapanıyor, yazılanlar kayboluyordu.
- **Neden:** Programın genel ESC kuralı zaten var: metin kutusunda ESC önce yalnız kutudan çıkarır. Ancak bu ekran açıkken genel kural kendini devre dışı bırakıyordu. Ekranın kendi ESC işleyicisi ise imlecin nerede olduğuna bakmadan `close()` çağırıyordu.

## Kural (kullanıcı kararı) ve uygulama
1. **Faturaları Luca'ya kaydet ekranı ESC ile hiç kapanmaz.** Ekran yalnız "✕ Kapat" ile kapanır.
2. **Giriş kutusundayken ESC** (metin kutusu ya da açılır liste) yalnız kutudan çıkarır.
   - Yazılan değer durur ve her zamanki gibi kutudan çıkınca kaydedilir.
   - Hesap öneri listesi açıksa ESC yalnız listeyi kapatır; kutuda kalınır.
3. **Üstte küçük pencere varsa** ESC yalnız onu kapatır; imleç pencerede bir kutudaysa önce kutudan çıkarır.
   - Örnekler: Kural yap, Kod tanımları, Kurallar, fiş penceresi, Kod tanımları ▾ menüsü.
   - Ortak yardımcı: `escKutu()`.

### Taranan ve düzeltilen diğer ekranlar
Bu pencerelerde ESC, imleç kutudayken bile pencereyi kapatıyordu. Hepsi artık önce yalnız kutudan çıkarıyor:
- **Banka:**
  - Firma ayarları ve Kurallar pencereleri
- **Ayarlar ve giriş:**
  - Ayarlar
  - Luca giriş penceresi
  - Veri ve yedek
- **Hesap ve Mizan:**
  - Hesap ekleme penceresi (hesap planı)
  - Mizan / Muavin paneli (süzgeç kutusunda ESC paneli kapatmaz) ve yeni hesap kodu penceresi
- **Genel pencereler:**
  - yönetim üye penceresi, ÖKC, çek, banka mutabakat, özet pencereleri
- **Fiş Girişi:** Girilmiş ama Luca'ya kaydedilmemiş satır varken ESC ekrandan çıkarmıyor ve kısa bir uyarı gösteriyor. Satırlar zaten bellekte tutuluyordu; şimdi ESC ile yanlışlıkla ekrandan da çıkılmıyor. Başka ekrana menüden geçilebilir, satırlar korunur.
- **Belgeden Fiş önizlemesi:** Önceden de ESC kutudan çıkarıyordu ve değişiklikler kutudan çıkınca belgeye kaydediliyor; veri kaybı yok. Kutu dışında ikinci ESC eskisi gibi Modüller ekranına döner.

## Testler (e2e)
- **Luca'ya kaydet:** Hesap kutusunda ESC, ekran açık, değer duruyor, imleç kutudan çıktı. İkinci ESC'de ekran yine açık. Fiş görünümündeki tutar kutusunda ESC'de de ekran açık.
- **Kural yap penceresi:** Kutuya " ESC" yazılınca ESC, pencere açık ve yazı duruyor. İkinci ESC pencereyi kapatıyor, ekran açık.
- **Fiş Girişi:** Satır girildikten sonra iki kez ESC, ekran açık, satır duruyor.
- **Değişmeyen davranış:** Önceki ESC denetimleri aynen geçiyor: Mizan paneli, Kod tanımları menüsü, yönetim penceresi, Belgeden Fiş'ten Modüller'e dönüş.
- **Sonuç:** `xvfb-run -a node test/e2e.js` → **366 ✓, 0 başarısız**

## Değişen dosyalar
- `renderer/app.js`: `escKutu()` yardımcısı, Luca'ya kaydet ESC işleyicisi, yukarıdaki pencerelerin ESC işleyicileri, hesap öneri listesi, `FISG.kirli()` ve `geri()`
- `test/e2e.js`
- `yonetim/raporlar/rapor-47.md`
