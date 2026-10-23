# MuhaWin – Menü düzeni (menü oturumu; 23.10.2026, kaynak 2.9.10 incelendi)

Bu oturumun tek işi: menü düzenini denetlemek ve öneri sunmak. Kod değişikliği yalnız kullanıcı onayıyla.
Not: 2.9.12 zip'i D:\EkstreLuca\MuhaWin'de yok; 2.9.10 incelendi (2.9.11/12 menü yapısını değiştirmedi).

## Mevcut gezinme katmanları (7 ayrı mekanizma)
1. Modül seçim ekranı (`#modGate`, `drawModules`): Banka İşlemleri · Muhasebe İşlemleri · Hızlı Fiş Girişi · Denetim ve Analiz · Ofisinize Özel · Geçici Vergi (yakında) · Personel (yakında) · Yönetim (sahip).
2. Üst şerit (`header.top .firmbar`): Firma seç · Yeni firma · Mizan/Muavin · Luca'da Çalış · Modüller · Ara (Ctrl+K) · İşler · Tema · Ayarlar.
3. Banka: `#modeTabs` (Banka / Kredi kartı) + `#toolbar` (Luca bağlan · Luca'dan firma ekle · Mizanları güncelle · Veri ve yedek | Firma ayarları · Kural ekle · Kurallar) + `#bottombar` (aynı düğmelerin kopyası).
4. Muhasebe: `#fkNav` (Toplu Kontrol · Tek Firma/Dosyadan · Fiş Girişi · Fiş Listesi · KDV Beyannamesi).
5. Toplu Kontrol iframe sekmeleri: Sonuçlar · KDV2 Raporu · Aylık geçmiş · Firmalar · Dönem · ⚙ Ayarlar.
6. Tek Firma sonuç sekmeleri: Fatura kontrol · Faturası bulunamayan · Fatura dışı · KDV tevkifatı (KDV2) · Okunan faturalar · Red/iptal.
7. Hub kartları (Denetim: Ters bakiye · Cari (gel.) · Banka mutabakatı · Günün özeti · KDV iade (gel.); Özel: Mikro Denetim · Çek/Senet) + Komut paleti (Ctrl+K, Alt+1…9).

## Bulgular
- Modüller arası geçiş yalnız tam ekran modül seçiminden (veya gizli Alt+n); kalıcı modül menüsü yok.
- "Fiş Girişi" (Muhasebe) ile "Hızlı Fiş Girişi" (ayrı modül) adları çakışıyor.
- 3 ayrı "Ayarlar": üst şerit Ayarlar (10+ bölüm tek uzun sayfa), Toplu ⚙ Ayarlar sekmesi, Firma ayarları.
- Firma ekleme 2 yerde: "Yeni firma" (üst) ve "Luca'dan firma ekle" (toolbar). "Veri ve yedek" hem toolbar hem Ayarlar'da.
- `#bottombar` = `#toolbar` kopyası.
- KDV2 3 yerde: Toplu → KDV2 Raporu, Tek Firma → KDV tevkifatı, KDV Beyannamesi.
- Banka mutabakatı Banka modülünde değil, pasif "Denetim ve Analiz" altında.
- Üst şeritte 9 denetim; Tema birinci seviyede.
- Alt+7 boş (numara boşluğu); Denetim modülünün kısayolu yok.
- "Mizan / Muavin" Muhasebe'de de görünüyor ama bir modüle ait değil.
- (Bağımsız mod, düşük öncelik) toplu.html nav: metin "Tek firma / dosyadan kontrol", href `/toplu` + `aktif`. MuhaWin içinde gizli.

## Öneri A (önerilen): kalıcı sol menü + sade üst şerit
Sol menü (daraltılabilir, lisans durumu rozetli: Deneme / Kilitli / Yakında):
- Ana sayfa (günün özeti, süren işler, Luca durumu)
- Fatura Kontrol › Toplu Kontrol · Tek Firma / Dosyadan
- Banka › Banka ekstreleri · Kredi kartı ekstreleri · Banka mutabakatı
- Fişler › Fiş Girişi (elle) · Belgeden Fiş (eski Hızlı Fiş Girişi) · Fiş Listesi
- Beyanname › KDV 1 / KDV 2 · Geçici Vergi (yakında)
- Denetim › Mizan / Muavin / Hesap planı · Ters bakiyeli hesaplar · Cari mutabakat (yakında)
- Personel (yakında) · Ofisinize Özel (yalnız tanımlıysa)
- Alt: Ayarlar · Yönetim (sahip)
Üst şerit: Firma seçici · Luca durumu (tek düğme; açılır: Bağlan / Luca'da Çalış / Firma ekle / Mizanları güncelle) · Ara (Ctrl+K) · İşler · Kullanıcı menüsü (Tema, Hesap, Çıkış).
Ayarlar: tek pencere, sol sekmeli: Genel/Tema · Hesap ve Lisans · Ofis ve çalışanlar · Luca girişi · Fatura Kontrol (Toplu ayarları buraya) · WhatsApp · Veri ve yedek · Hakkında.
Firma kartı: Genel · Banka/Kart hesapları · Banka kuralları · Fatura kuralları.
Alt+1…n sol menü sırasıyla.

## Öneri B: modül seçimi kalır + üstte kalıcı modül sekme çubuğu
Daha az iş; ad çakışması ve Ayarlar dağınıklığı ayrıca düzeltilir.

## Öneri C: yalnız temizlik
bottombar kaldır, Tema → Ayarlar, "Hızlı Fiş Girişi" → "Belgeden Fiş", Banka mutabakatı → Banka, Alt+7 düzelt.

## Riskler
- e2e (250) seçicilere bağlı (`#modGate`, `[data-mod]`, `#fkNav`, `#toolbar`) → test güncellemesi gerekir.
- Modül lisansı (`licenseGate`) menü öğesi tıklamasına taşınmalı.
- FK iframe kendi sekmeleri: iç sekmeler kalmalı (Sonuçlar/Firmalar), Ayarlar sekmesi dışarı alınırsa `toplu.html` mesajlaşması gerekir.

## Bekleyen karar
A / B / C seçimi; menü grupları ve adlar kullanıcı onayı.
