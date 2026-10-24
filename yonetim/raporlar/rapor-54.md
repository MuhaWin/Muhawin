# Rapor 54 – Görsel düzen: düğme renkleri, Veri ve yedek, seçili düğme taşması, dikey alan ve sığdırma

**Oturum:** Menü düzenleyici (`session_01PTJcvhW9nnYrh4fnPgxK4n`) · **Taban:** `main` (b4793cc birleştirildi) · **Dal:** `claude/affectionate-darwin-effcgp`

- Derleme yapılmadı.
- Görseller ve testler yalnız sahte veriyle hazırlandı.
- Önce/sonra görselleri ve öneri ayrıntısı `yonetim/gorsel/g54/` klasöründe; açıklama `OKUBENI.md` dosyasında.
- Dikey alan düzeni yöneticinin isteğiyle onay beklemeden uygulandı. Kullanıcı denemede beğenmezse geri alınabilir.

## 1. Düğme renkleri

Renkler temanın kendi kırmızı (`--out`) ve yeşilinden (`--in`) türetilir; bütün temalarda okunur.

| Düğme | Görünüm |
|---|---|
| Kapat | turuncu-kırmızı açık zemin, aynı renk yazı ve çerçeve; üzerine gelince dolu |
| Yenile (⟳, "… Yenile") | yeşil açık zemin, yeşil yazı ve çerçeve; üzerine gelince dolu |
| Kaydet / Luca'ya kaydet / Aktar | ana renk dolu (değişmedi) |
| Sil türü (danger) | kırmızı yazı + kırmızı çerçeve |
| Kalıcı silme onayı (dangerfill) | kırmızı dolu (değişmedi) |
| Diğerleri | nötr |

- **Kontrast:** Açık temada Kapat yaklaşık 4,9:1, Yenile yaklaşık 5,5:1; koyu temada 6:1'in üstünde.
- **Sınıf verme:** `.kapat` ve `.yenile` sınıfları düğme metninden kendiliğinden verilir (`app.js › dugmeRenk`). Fatura Kontrol sayfalarında aynı işi `tema.js` yapar. Sonradan çizilen düğmeler de izlenir.

## 2. Veri ve yedek

- **Kaldırılan yer:** Banka ve Kredi kartı araç çubuğundaki düğme kalktı. Veri ve yedek yalnız Ayarlar'da bir bölüm (`#veriYedekSec`).
- **Komut paleti:** Ctrl+K'de "Veri ve yedek" Ayarlar'ı açıp bu bölüme kaydırır.
- **Bulunan eski hata:**
  - Paletteki "Ayarlar" ve "Güncellemeleri denetle" komutları ile Ctrl+S, Ayarlar'ı açmıyordu: `openReg` paletin kapsamında değildi.
  - `window.__ayarAc` ile düzeltildi; e2e Ctrl+S'yi denetliyor.

## 3. Seçili düğme taşması

- **Sorun:** Seçili hâl dış çizgi (outline) ve kalın yazıyla veriliyordu. Düğme büyüyor ve çerçevenin sol kenarından taşıyordu.
- **Çözüm:**
  - Çerçeve iç gölgeyle (`box-shadow: inset`) veriliyor.
  - Kalınlık metin gölgesiyle veriliyor; genişlik değişmiyor.
  - Kutu grubu çerçevenin içinden 3 px boşlukla başlıyor.
- **Düzeltilen gruplar:**
  - Fatura Kontrol toplu: sekmeler ve "Tümü" kutuları.
  - Fatura Kontrol tek firma: sekmeler ve kutular.
  - Denetim: özet kutuları ve ay düğmeleri.
  - Kullanılmayan `fkchip`.
- **Ölçüm:**
  - `test/cakisma.js › seciliTasma` her sekme/çip/süzgeç grubunda her düğmeyi seçili yapıp boy değişimini ve çerçeveden taşmayı ölçer.
  - `test/ekran.js` bütün ekranlarda çağırır; e2e toplu kontrol grubunu ayrıca denetler.

## 4. Dikey alan ve sığdırma

| Ekran (1366×768, sahte veri) | Önce | Sonra |
|---|---|---|
| Luca'ya kaydet (16 fatura) | yaklaşık 2 satır görünür | 11 tam satır; yatay kaydırma yok |
| Muavin (12 hareket) | 4 satır | 12 satır (tamamı) |
| Toplu kontrol sonuçları | yatay kaydırma, firma adları 3 satır | sığıyor, firma adı tek satır |
| Banka | işlem sütunu sağda kesik | sığıyor |

- **Üst bant:**
  - Tek satır: logo · firma · Luca · Mizan / Muavin / Hesap Planı · Luca'da Çalış · Modüller · Ara · Tema (simge) · Ayarlar.
  - Alt açıklama ve modül adı başlıktan kalktı; modül adı sekmede görünüyor.
  - 1200 px'den dar pencerede eski gibi alta kayar.
- **Sekmeler:** Muhasebe alt sekmeleri (Toplu Kontrol … KDV Beyannamesi) modül sekmeleriyle aynı satırda (`#sekmeSatir`).
- **Luca'ya kaydet:**
  - **Üst kısım:** Başlık satırı tek satır; firma ve dönem satırı gerekirse "…" ile kısalır.
  - **Araç çubuğu tek satır:** Durum süzgeçleri · arama · Hepsi/Eksik/Dolu · Kuralları uygula · Seçili · **Süzgeç ▾** · Kod tanımları ▾ · **Diğer ▾**.
    - "Diğer ▾" menüsü: Boşları doldur, Tümünü seç, Seçimi kaldır, Seçilenleri kaydetme, Kurallar, Toplu hesap, Belge türü.
    - "Süzgeç ▾" sütun süzgeç satırını ve Kurallı/Kuralsız seçimini açar; bir süzgeç doluyken açık kalır.
  - **Satırlar iki satıra indi:**
    - Kalem açıklaması VKN'nin yanında kısalır; tamamı imleç ipucunda.
    - Hesap kodunun yanında Kod/Geçmiş/Kural seçimi var, hesap adı altında. Kural metni kod kutusunun ipucunda.
    - PDF ve Fiş görünür; Kural yap ve Kaydetme "⋯" satır menüsünde. Menü sabit konumlu olduğu için tablo kaydırmasında kırpılmaz.
  - **Menülerin ortak davranışı:** Açılır menüler (Kod tanımları, Diğer, satır ⋯) aynı davranır. Oklarla gezilir, Esc ile kapanır ve odak düğmeye döner, dışarı tıklayınca kapanır.
- **Mizan / Muavin:** Hücreler tek satır; uzun açıklamanın tamamı imleç ipucunda. Başlık ve araç çubuğu inceldi.
- **Banka:**
  - Özet kartları tek satır.
  - Karşı hesap adı ve banka adı kısalır; tamamı imleç ipucunda.
  - Satır düğmeleri sığıyor.
- **Toplu kontrol (Fatura Kontrol):**
  - Sol panel 236 px; "◂" ile daraltılabilir ve bu bilgisayarda hatırlanır.
  - Sütun başlıkları alt satıra geçer; firma adı tek satır.
  - Durum kutuları ince çip.
- **Ölçüm (`test/ekran.js`):**
  - Banka, mizan, Luca'ya kaydet ve toplu kontrol (çerçeve) tablolarında yatay kaydırma yok; 1280 px ve üstü, %100–200 ölçek.
  - Luca'ya kaydet 1366×768'de en az 10 satır gösteriyor.

## 5. Testler

e2e ve pytest sonuçları PR açıklamasında.

## Notlar

- **Kaldırılan şart:** e2e'deki "Luca'ya kaydet araç çubuğu 1440 px'de iki satır" şartı (Görev 41) "tek satır" olarak güncellendi. Kurallar düğmesi artık Diğer menüsünde.
- **Kısalan etiket:** "MuhaWin ile kaydedilen" süzgecinin adı "Kaydedilen" oldu; uzun adı imleç ipucunda.
- **Ekran ölçüm verisi:** Luca'ya kaydet ekran ölçümü artık 16 sahte faturayla yapılıyor (önce 8).
