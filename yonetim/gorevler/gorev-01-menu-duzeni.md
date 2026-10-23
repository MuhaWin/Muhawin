# Görev 01 – Menü Düzeni

**Durum:** Karar verildi: **B (üstte modül sekmeleri)**. Kod henüz yazılmadı. · **Taban:** `main` (2.9.12) · **Dal:** `gorev-01-menu-duzeni` · **Mesaj sınırı:** 20
Önceki çalışma: `yonetim/belgeler/menu-duzeni.md` (analiz), `yonetim/raporlar/rapor-01.md` (ara rapor ve istek listesi).

## Başlarken
1. `yonetim/YONETICI.md` dosyasındaki "İşçi oturum kuralları" bölümünü uygula.
2. Bu kartı ve `rapor-01.md` dosyasını oku. Analiz tamamlandı, yeniden yapma.
3. `main` dalından `gorev-01-menu-duzeni` dalını aç.

## Kapsam (rapor-01 istek listesi)
1. Üstte kalıcı modül sekme çubuğu: Banka · Muhasebe · Belgeden Fiş · Denetim · Ofisinize Özel · Geçici Vergi (yakında) · Personel (yakında).
2. "Yeni firma" düğmesini üst şeritten kaldır, Ayarlar → Firmalar bölümüne taşı. "Luca'dan firma ekle" için kullanıcıya sor.
3. Luca giriş düğmesi yalnız üst şeritte kalsın ("Luca'ya giriş" / "● Luca bağlı"). Diğer tüm "Luca'ya bağlan" düğmelerini kaldır:
   - Banka toolbar `data-luca="connect"`
   - okcPanel, cekPanel, fkKayit
   - `data-lucabag`
   - `#modLucaBag`
4. ~~Luca sayfa yönetimi~~ → **kapsam dışı**, ayrı görev olacak. Dokunma.
5. Düğme adı "Mizan / Muavin / Hesap Planı" olsun. Sekme sırası Mizan · Muavin · Hesap Planı, varsayılan sekme Mizan.

Değişmeyecekler:
- Oyun modülü geri gelmez.
- Pasif menüler ("Çok yakında") pasif kalır.
- "Ser.Mes.Defteri" adı kalır.
- `licenseGate` davranışı aynı kalır.
- `luca.js` ve sunucu API'lerine dokunulmaz.

## Kabul ölçütleri
- 1, 2, 3 ve 5. maddeler yapılmış ya da gerekçesiyle ertelenmiş olmalı.
- Madde 3 için: Luca gerektiren işlemler bağlantı yokken sessizce başarısız olmamalı. Açık bir uyarı göstermeli ve üst şeritteki giriş düğmesini vurgulamalı. Bunu en az bir e2e testi doğrulamalı.
- Testler:
  - `xvfb-run -a node test/e2e.js` (250 + yeni testler). Seçiciler değiştiyse testleri de güncelle.
  - `node test/mobil.js` (42)
  - `cd fk && python3 -m pytest -q`: yalnız `toplu.html` ya da FK menüsü değiştiyse çalıştır.
- Commit'ler Türkçe ve adım adım olmalı. **Derleme yapılmaz.**

## Teslim
- Dalı push et ve `Görev 01: Menü düzeni (B)` başlıklı PR'ı aç.
- Aynı PR'da `yonetim/raporlar/rapor-01.md` dosyasını güncelle:
  - istek durumu
  - commit listesi
  - değişen dosyalar
  - test sayıları
  - riskler
  - devir notu
