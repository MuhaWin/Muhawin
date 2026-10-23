# Rapor 21 – Kural yap: çoklu şart (VE) ve "Hiç kaydetme"

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (#46 birleştikten sonra aynı dal; `main` birleştirildi, push zorlamasız).

## İstekler
| İstek | Durum |
|---|---|
| Kural ekle/düzenle ekranında "+" ile 2., 3. şart; şartların hepsi birlikte tutmalı (VE) | **Yapıldı.** "+ Şart ekle" ile en çok 5 şart girilebilir; her şartın yanında × ile kaldırma var. Her şart bugünkü sözdizimiyle yazılır: `\|` = ya da, `+` = hepsi. Yön (giriş / çıkış) kural başına tek seçim, bugünkü gibi. |
| Kural eylemi: "Kaydet" ya da "Hiç kaydetme" | **Yapıldı.** "Şartlar tutarsa" seçimi eklendi: **Kaydet · karşı hesaba** (bugünkü davranış) ya da **Hiç kaydetme · fişe alma**. Ayrıntılar aşağıda. |
| Eski kurallar aynen çalışmalı | **Yapıldı.** Ayrıntılar aşağıda. |
| Kurallar listesinde çoklu şartlar okunaklı görünsün | **Yapıldı.** Şartlar arasında "VE" etiketi var. Hiç kaydetme kurallarında karşı hesap yerine "hiç kaydetme · fişe alınmaz" yazar. Kurallarda arama tüm şartlarda yapılır. |

### "Hiç kaydetme" eylemi
- Bu seçimde karşı hesap ve Luca açıklaması kutuları gizlenir.
- Kurala uyan hareket fişten çıkarılır: fişe dahil kutusu boş, satır soluk gösterilir.
- Satırın rozeti "kaydetme" olur; üzerine gelince kural yazar.
- Kullanıcı satırı yeniden işaretlerse kural kararını ezmez. Satırın hesabı askı hesabıdır.
- "Kurallı" süzgecinde de sayılır.

### Geriye uyumluluk
- Veri biçimi eklemeli: kurala isteğe bağlı iki alan geldi. `ek` (string dizisi: 2., 3. … şartlar) ve `eylem` (`'atla'` ya da yok).
- Eski kurallarda bu alanlar yok; onlar tek şartlı "Kaydet" kuralı olarak bugünkü gibi çalışır.
- Kayıt (`datastore.js` `addRule`) kural nesnesini olduğu gibi sakladığı için **göç kodu gerekmedi**. `datastore.js` değişmedi.
- Eşleşme sırası:
  - Çok şartlı kural tek şartlı kuraldan önce denenir, çünkü daha özel.
  - Şart sayısı eşitse eski sıra korunur: en uzun kelimeli kural önce.
  - Yalnız tek şartlı kurallar olan firmalarda sonuç değişmez.

## Değişen dosyalar
- `renderer/index.html`:
  - yardımcılar: `kuralSartlari`, `kuralMetni`, `kuralAtla`, `kurallimi`
  - `buildMatcher`
  - `eslesmeUygula` (yeniden eşleştirme, yön çevirme ve askıdan çıkarma tek yerden)
  - fişe dahil kutusu
  - `srcChip` rozeti
  - kural formu ve listesi, `kuralTaslak`, `saveRule`
- `renderer/style.css`: `.chip.atla`, `.rule .k .ve`, `.rsart-s`
- `test/e2e.js`
- `yonetim/raporlar/rapor-21.md`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **283 ✓, 0 başarısız** (`main` birleştirilmeden önceki çalışma). `main` birleştirildikten sonraki çalışmanın sonucu PR açıklamasında.
- `node test/mobil.js`: **45/45.**
- Yeni e2e denetimleri:
  - Eşleştirme: VE kuralı yalnız tüm şartlar tutunca uygulanıyor; tutmayınca tek şartlı eski kural geçerli; yön denetimi; "hiç kaydetme" kuralı.
  - Satıra uygulama: "hiç kaydetme" hareketi fişe alınmıyor; elle yeniden işaretlenince kural ezmiyor.
  - Arayüz: "+ Şart ekle" önceki şartları koruyor; "Hiç kaydetme" seçilince karşı hesap ve açıklama gizleniyor; listede "HAVALE VE KENDİ HESABIM VE ZİRAAT | VAKIF · hiç kaydetme".

## Riskler
- Bu sürümle kaydedilen çok şartlı ya da "hiç kaydetme" kuralı eski bir sürümde açılırsa yalnız 1. şart görülür. Eski sürüm "hiç kaydetme" kuralını karşı hesabı boş olduğu için yok sayar; geniş eşleşme olmaz.
- Tablodaki "Kural yap" penceresi (satırdan hızlı kural) bugünkü gibi tek şartlı. Çok şart ve eylem için Kural ekle ekranı kullanılır.

## Devir notu
G21 tamam.
