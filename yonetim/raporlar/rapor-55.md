# Rapor 55 – Mizan: detay hesap (DH) sütunu ve kalın üst hesaplar

**Oturum:** Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · **Taban:** `main` `555ce25` · **Dal:** `claude/beautiful-bohr-c7x9ij`

Derleme yapılmadı.

## Yapılanlar
- **`renderer/hesap_dh.js` (yeni):** Detay hesap kararını veren tek yer. Node testinde de kullanılıyor.
  - Bir kodun altında mizanda başka bir kod varsa **H**, yoksa **E**. "Altında" demek, "kod." ile başlayan başka bir kod olması.
  - Boşluklu ya da tireli kodlar (`102 01 07`, `102-01`) noktalıya çevrilerek karşılaştırılıyor.
  - Yalnız rakamdan oluşan kodlarda (`1020107`), kendisiyle başlayan daha uzun bir kod varsa H. Noktalı bir kodun birleşik yazımı da sayılıyor (`102.01.07` için `10201` H olur).
  - `102.1` ile `102.10` birbirinin alt hesabı sayılmıyor.
- **Mizan sekmesi (Mizan / Muavin / Hesap Planı penceresi):**
  - Hesap adından sonra **DH** sütunu eklendi (E / H). Başlığın ipucunda anlamı yazıyor.
  - Hem Luca / Excel mizanında hem "Muavinden oluştur" mizanında çalışıyor.
  - **H satırları kalın ve koyu renkli** (`tr.ust`), E satırları normal yazıyla. Mizanda düzeye göre kalınlık (`lv1` / `lv2`) yerine artık bu kural geçerli. Hesap Planı sekmesi değişmedi.
  - Ters bakiyeli satırlar yine kırmızı.
  - "Yalnız muavin (en alt)" düzey seçimi aynı kararı kullanıyor.
- **Süzgeç ve sıralama:** DH sütununda süzgeç var ("E/H" yazılır) ve başlığa tıklayınca sıralanıyor. Sütun dar (44 px) ve ortalı.
- **Yatay kaydırma:** Aynı stil dosyasıyla 1366 px'te kaydırma oluşmuyor. 980 px'teki 17 px'lik kaydırma DH olmadan da vardı; Görev 41 ölçümü yatay kaydırmayı 1280 px ve üstünde denetliyor.
- **Excel'e aktarma:** DH sütunu çıktıda da var.
- **Fatura Kontrol / denetim:** Mizan görüntüleme tablosu yok (yönetici raporu mizanı yalnız hesaplamada kullanıyor), bu yüzden orada değişiklik gerekmedi.

## Testler
- **`node test/hesap_dh.js` (yeni):** 8 kontrol, CI'ye (`surum.yml`) eklendi.
  - 102 / 102.01 / 102.01.07 / 102.01.07.01 örneğinde yalnız sonuncusu E.
  - Kardeş detaylar, `102.1` ↔ `102.10`, boşluklu / tireli / noktasız / karışık yazım, alt hesabı olmayan ana hesap, sayı olarak gelen kod.
- **`test/e2e.js` (Mizan sekmesine kontrol eklendi):**
  - DH sütunu var ve her satırdaki değer `HesapDH` ile aynı.
  - H satırlarının yazısı kalın (≥700), E satırları normal.
  - Mizan kutusunda yatay kaydırma yok.
  - 102 örneği doğru çıkıyor.
  - Electron bu ortamda çalıştırılmadı.
- **Görünüm:** Programın stil dosyasıyla örnek tablo tarayıcıda denendi; H satırları kalın, E normal.
