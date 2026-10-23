# Rapor 01 – Menü Düzeni (B)

**Seçim:** B. Üstte modül sekmeleri var (kullanıcı kararı).
**Durum:** Kod yazıldı. PR açıldı: `Görev 01: Menü düzeni (B)`. İşçi oturumu: **Menü Düzenleme**.
**Dal:** `claude/affectionate-darwin-effcgp`. Oturum ortamı yalnız bu dala push'a izin veriyor, bu yüzden kartta yazan `gorev-01-menu-duzeni` kullanılmadı. Dal `main` (aa07fa7) üzerinden açıldı.

## İstek listesi
| # | İstek | Durum |
|---|---|---|
| 1 | Üstte kalıcı modül sekme çubuğu: Banka · Muhasebe · Belgeden Fiş · Denetim · Ofisinize Özel · Geçici Vergi (yakında) · Personel (yakında) | **Yapıldı.** `#modSekme` üst şeridin altında. Sekmeye basınca `licenseGate` modül kartındakiyle aynı şekilde çalışır, sonra `enterModule` modülü açar. Modül seçim ekranı açılmaz. "Yakında" olan modüller pasif kalır ve "(yakında)" yazar (Denetim bugün pasif). "Ofisinize Özel" yalnız ofise tanımlıysa görünür. "Yönetim" sekmesi yalnız program sahibine görünür. Muhasebe paneli sekmelerin altına yerleşir. "▦ Modüller" düğmesi ve modül seçim ekranı yerinde duruyor. |
| 2 | "Yeni firma" ve "Luca'dan firma ekle" Ayarlar → Firmalar bölümüne taşınsın | **Yapıldı.** "Yeni firma" üst şeritten, "Luca'dan firma ekle" Banka araç çubuğundan (ve onun kopyası alt çubuktan) kaldırıldı. İki düğme de Ayarlar → Firmalar'da (`#regFirmEkle`). Komut paletinde ikisine de giriş var. Firma eklemeyi anlatan uyarı yazıları yeni yere yönlendiriyor. |
| 3 | Luca giriş düğmesi yalnız üst şeritte olsun ("Luca'ya giriş" / "● Luca bağlı") | **Yapıldı.** Tek düğme kaldı: `#lucaTopBtn`. Kaldırılanlar: Banka araç çubuğundaki `data-luca="connect"`, okcPanel, cekPanel, fkKayit, Fiş Girişi ve Mizan panelindeki `data-lucabag` düğmeleri, `#modLucaBag`. Modül seçim ekranındaki bant (`#modLuca`) artık yalnız durum yazar. Luca gerektiren bir işlem bağlantı yokken başlarsa `LucaBag.uyar` çalışır: açık bir uyarı gösterir ve üst şeritteki düğmeyi 6 sn yanıp sönerek vurgular. Giriş penceresi de eskisi gibi açılır, bağlanınca işlem kendiliğinden sürer. Bu davranış tüm `LucaBag.bekle()` çağrılarında ve Desk'in "Luca'dan yenile" / "Luca'ya aktar" yollarında geçerli. |
| 4 | Luca sayfa yönetimi | **Kapsam dışı**, dokunulmadı. |
| 5 | Düğme adı "Mizan / Muavin / Hesap Planı" olsun, sekme sırası Mizan · Muavin · Hesap Planı, varsayılan Mizan | **Yapıldı.** Panel başlığı da aynı ada geçti, komut paletindeki sıra da güncellendi. |

Değişmeyenler: Oyun modülü yok. Pasif menüler pasif. "Ser.Mes.Defteri" adı aynı. `licenseGate` davranışı aynı. `luca.js`, `main.js` ve sunucu API'lerine dokunulmadı. Modül kartlarındaki "Hızlı Fiş Girişi" adı değişmedi; "Belgeden Fiş" adı yalnız sekmede kullanılıyor.

## Commit'ler
- `c35ce14` Görev 01: menü düzeni B – üstte modül sekmeleri, tek Luca giriş düğmesi
- `2c65a6b` Görev 01: e2e testleri yeni menü düzenine göre güncellendi
- `7377ea2` Görev 01: e2e – Luca düğmesi yazısı büyük/küçük harf duyarsız, LucaBag teste açıldı
- Bu rapor (son commit)

## Değişen dosyalar
- `renderer/index.html`
- `renderer/style.css`: `.modsekme`, `.modsek`, `#lucaTopBtn.vurgu`
- `test/e2e.js`
- `yonetim/raporlar/rapor-01.md`

## Testler (Linux, xvfb; derleme yapılmadı)
- `node test/mobil.js`: **42 geçti, 0 başarısız.**
- `xvfb-run -a node test/e2e.js`: **215 ✓, 1 HATA.**
  - Hata 1. senaryoda: ÖKC görüntü okuma (OCR) adımı 90 sn içinde bitmedi (`okf` bekleniyor, e2e.js:533).
  - Aynı hata değişiklik öncesi `main`'de de çıkıyor (taban: 203 ✓, aynı HATA). Bu ortamdan kaynaklanıyor (bulut kapsayıcısı, OCR), bu PR'la ilgisi yok.
  - Hata 1. senaryonun kalanını kestiği için iki denetim bu ortamda çalışmadı: "Ayarlar › Firmalar düğmeleri" denetimi ve senaryonun sonundaki diğer denetimler. Windows'ta / tam ortamda çalıştırılmalı.
- Taban ile karşılaştırma: 14 yeni denetim eklendi, 4 denetim yeni davranışa göre değişti. Kaybolan ya da yeni kırılan denetim yok.
- Yeni e2e denetimleri:
  - modül sekmelerinin sırası ve pasif olanları
  - sekmeden Belgeden Fiş'e geçip Banka'ya dönüş
  - Muhasebe sekmesinin seçili olması ve panelin sekmelerin altında başlaması
  - Yeni firma / Luca'dan firma ekle düğmelerinin üst şeritte olmaması
  - tek Luca düğmesi ve iki durumdaki yazısı
  - **Luca yokken uyarı + vurgu; bağlanınca işlemin sürmesi** (kabul ölçütü)
  - Mizan düğmesinin adı, varsayılan sekme ve sekme sırası
- `fk` pytest çalıştırılmadı: `toplu.html` ve FK menüsü değişmedi.
- Test ortamı notu: e2e için `fk/.venv` (requirements + pillow, reportlab) kuruldu ve bu ortam PATH'e eklendi. Depoya eklenmedi.

## Riskler
- Mizan paneli ve fatura kaydı (`fkKayit`) tam ekran açılıyor; açıkken üst şerit görünmüyor. Bu ekranlarda Luca gerektiren işlemde uyarı yazısı ve otomatik açılan giriş penceresi görünür, vurgulanan düğme ise ancak panel kapanınca görünür.
- Modül seçim ekranında artık Luca'ya bağlanma düğmesi yok, bant yalnız durumu yazıyor. Kullanıcı Luca'ya modüle girdikten sonra bağlanır.
- Üst şeritte bir düğme eksildi, bir düğme eklendi. Dar pencerede şerit iki satıra inebilir.
- `window.__lucaBag` test için dışarı açıldı (diğer `window.__*` erişimleri gibi).

## Devir notu
- Kapsam tamam.
- Kalan iş:
  - Windows'ta e2e'nin tamamını çalıştırıp 1. senaryonun sonunu doğrulamak.
  - Açık konu 1 (Luca sayfa yönetimi) ayrı görev olarak açılacak.
  - İsteğe bağlı: modül kartında da "Hızlı Fiş Girişi" adını "Belgeden Fiş" yapmak (test ve OKUBENI etkilenir).
