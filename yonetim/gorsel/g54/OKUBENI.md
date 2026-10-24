# Görev 54 – önce / sonra görselleri (onay için)

- **Veri:** Bütün görseller sahte veriyle çekildi (uydurma firmalar, VKN'ler ve faturalar).
- **Önce:** Güncel `main` (8e87e6e).
- **Sonra:** Programa uygulanan düzen (yöneticinin isteğiyle onay beklemeden uygulandı; kullanıcı denemede beğenmezse geri alınır).
- **`taslak.js`:** İlk prototip; artık yalnız iz olarak duruyor.
- **Üretim:** `GORSEL_FATURA=16 GORSEL_PNG=1 GORSEL_BOY=1366x768 GORSEL_OLCEK=1 [GORSEL_EK=yonetim/gorsel/g54/taslak.js] node tools/site-gorsel.js yonetim/gorsel/g54`

## Görseller

| Ekran | 1366×768 (%100) | 1920×1080 @%125 |
|---|---|---|
| Luca'ya kaydet | `once-1366x768-program-kaydet.png` → `sonra-1366x768-program-kaydet.png` | `once-1920x1080@125-program-kaydet.png` → `sonra-…` |
| Toplu kontrol sonuçları | `…-program-toplu.png` | `…-program-toplu.png` |
| Mizan / Muavin | `…-program-mizan.png` | `…-program-mizan.png` |
| Banka | `…-program-banka.png` | `…-program-banka.png` |

### Görünen satır sayısı (1366×768)

| Ekran | Önce | Sonra |
|---|---|---|
| Luca'ya kaydet (16 fatura) | yaklaşık 2 | 11 tam satır |
| Toplu kontrol | 3 (yatay kaydırma var) | bütün liste, yatay kaydırma yok |
| Muavin (12 satır) | 4 | 12 (tamamı) |
| Banka | 8 (sağda işlem sütunu kesik) | 9, kesik yok |

## Uygulanan değişiklikler

1. **Üst bant tek satır:**
   - Satırda: logo · firma · Luca · Mizan/Muavin · Luca'da Çalış · Modüller · Ara · Ayarlar.
   - "Firma" etiketi ve alt açıklama kalkar.
   - Tema düğmesi yalnız simge olarak kalır.
   - Etkisi: yaklaşık 70 px kazanılır.
2. **Modül sekmeleri ile alt sekmeler aynı satırda:** Muhasebe / Banka / Belgeden Fiş ‖ Toplu Kontrol / Tek Firma / Fiş Girişi / Fiş Listesi / KDV. Etkisi: yaklaşık 50 px.
3. **Luca'ya kaydet** (uygulamada Fiş düğmesi satırda görünür kaldı; Kod/Geçmiş/Kural seçimi kod kutusunun yanında, kurallı/kuralsız seçimi Süzgeç şeridinde):
   - **Başlık:** Başlık ve işlem düğmeleri tek satırda.
   - **Araç çubuğu tek satır:** durum süzgeçleri, arama, Kuralları uygula, Hepsi/Eksik/Dolu, Seçili, **Süzgeç ▾**, **Diğer ▾**.
   - **Diğer ▾ menüsü:** Boşları doldur, Tümünü seç / Seçimi kaldır, Seçilenleri kaydetme, Toplu hesap, Belge türü, Kurallar, Kod tanımları.
   - **Süzgeç ▾:** Sütun süzgeç satırı ve Kurallı/Kuralsız seçimi daraltılabilir olur; varsayılan kapalıdır.
   - **Satırlar iki satıra iner:**
     - Hesap adı kodun yanına alınır.
     - Kalem açıklaması imleç ipucuna taşınır.
     - Satır düğmeleri (Fiş, Kural yap, Kaydetme) "⋯" menüsüne girer; PDF simgesi kalır.
     - Kod / Geçmiş / Kural seçimi satır açılınca görünür.
   - **Başlık:** Liste başlığı yapışkan kalır.
4. **Toplu kontrol:**
   - Soldaki "Yeni toplu kontrol / İşlem özeti" paneli daraltılabilir; sonuç listesi tam genişlik kullanır.
   - Firma adları tek satıra iner, uzun ad imleç ipucunda görünür.
   - Durum kutuları ince çipler olur.
5. **Muavin:**
   - Araç çubuğu tek satır olur: Firma seçimi üstteki firma kutusundan gelir.
   - "Luca'dan yeniden çek", "Excel'den yükle" ve "PDF yazdır" Diğer ▾ menüsüne girer.
   - Uzun açıklamalar tek satır kalır; tamamı imleç ipucunda görünür.
6. **Banka:**
   - Özet kartları tek satır olur.
   - Sütun süzgeçleri daraltılabilir olur.
   - Satır işlemleri (Kural yap vb.) "⋯" menüsüne girer.
   - Tablo genişliğe sığar.
7. **Ölçüm:**
   - `test/ekran.js` ve `test/cakisma.js`, bu ekranlar için "yatay kaydırma yok" ve "1366×768'de en az 10 satır" denetimleri yapar.
   - Ölçüm boyları 1366×768 ve %125'tir.

## Onay beklemeden yapılanlar

- Düğme renkleri (aşağıdaki tablo).
- "Veri ve yedek" düğmesi Banka ve Kredi kartı araç çubuğundan kalktı. Artık yalnız Ayarlar'da bir bölüm. Komut paletinde (Ctrl+K) "Veri ve yedek" Ayarlar'daki bölümü açıyor.
- Seçili sekme, çip ve süzgeç düğmeleri büyümüyor ve çerçeveden taşmıyor:
  - Kalınlık metin gölgesiyle veriliyor.
  - Seçili çerçeve iç gölge olarak çiziliyor (dış çizgi yok).
  - Grup çerçevenin içinden boşlukla başlıyor.
  - `test/cakisma.js › seciliTasma` her gruptaki her düğmeyi seçip ölçüyor.

### Düğme renkleri

Renkler temanın kendi kırmızı ve yeşilinden türetilir. Açık, koyu ve yüksek kontrast temalarda okunur.

| Düğme | Görünüm | Not |
|---|---|---|
| Kapat (✕ Kapat, Kapat) | turuncu-kırmızı açık zemin, turuncu-kırmızı yazı ve çerçeve; üzerine gelince dolu | kullanıcı isteği |
| Yenile (⟳, "… Yenile") | yeşil açık zemin, yeşil yazı ve çerçeve; üzerine gelince dolu | kullanıcı isteği |
| Kaydet / Luca'ya kaydet / Aktar (ana işlem) | ana renk dolu (değişmedi) | ekrandaki asıl işlem |
| Sil / Tümünü sil / Kayıtlı bilgileri sil | kırmızı yazı + kırmızı çerçeve | yanlışlıkla basılmasın diye dolu değil |
| Kalıcı silme onayı | kırmızı dolu (değişmedi) | yalnız onay pencerelerinde |
| Diğer düğmeler | nötr (beyaz/yüzey zemin, ince çerçeve) | |
| Seçili sekme / çip | ana renk dolu ya da alt çizgi (değişmedi), boyut değişmez | |
