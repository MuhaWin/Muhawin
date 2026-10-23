# Rapor 24 – Oynak e2e adımı ve arayüz tutarlılık taraması

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi, push zorlamasız). Ekran görüntüleri `yonetim/raporlar/rapor-24/` klasöründe: `once-*` düzeltmeden önce, `sonra-*` düzeltmeden sonra.

## 1. Oynak adım: "hesap planında hesaba tıklayınca o hesabın muavini açıldı ()"
**Kök neden:**
- Test "Tümünü Luca'dan Çek"ten hemen sonra Hesap Planı sekmesine geçip **700 ms sabit** bekliyordu.
- Hesap Planı sekmesi planı zaman uyumsuz yüklüyor (`MMUI` → `await loadPlan()`). Yavaş CI makinesinde tablo bu sürede çizilmemiş oluyordu.
- Satır tıklaması `.catch(() => {})` ile sessizce boşa gidiyordu. Denetimdeki boş `()` da bunu gösteriyor: muavin başlığı hiç oluşmamış.

**Düzeltme** (test atlanmadı, yalnız beklemeler koşula bağlandı):
- önce bekleme penceresi (`#mwBusy`) kapanana kadar beklenir
- Hesap Planı sekmesine geçilir ve `tr[data-kod="320.01"]` satırı görünene kadar beklenir (en çok 15 sn)
- satıra tıklanır ve muavin başlığında `320.01` yazana kadar beklenir (en çok 15 sn)
- "Hesap planına dön" denetimi de 500 ms sabit beklemek yerine sekme seçilene kadar bekler

## 2. Arayüz tutarlılık taraması
Taranan ekranlar:
- modül seçimi
- Banka; Firma ayarları; Kural ekle ve kural listesi
- Ayarlar
- Mizanları güncelle
- Mizan / Muavin / Hesap Planı
- Belgeden Fiş
- Muhasebe: Toplu Kontrol, Tek Firma, Fiş Girişi, Fiş Listesi, KDV Beyannamesi

Her ekran **1280** ve **1024 px** genişlikte tarandı. Tarama yöntemi: ekran görüntüsü, sayfanın yatay kaydırma ölçümü, pencere dışına taşan öğeler ve düğme yükseklikleri (Playwright betiği).

### Yapılan küçük ve güvenli düzeltmeler
| # | Sorun | Düzeltme | Görüntü |
|---|---|---|---|
| D1 | Muhasebe alt sekmelerinde (Toplu Kontrol, Fiş Girişi, Fiş Listesi, KDV) seçili sekmenin üzerine fare gelince yazı okunmuyordu (açık zemin üzerine beyaz yazı) | Seçili sekme fare üstündeyken de koyu zeminli kalıyor | `once/sonra-1280-12-fis-girisi`, `-13-fis-listesi`, `-14-kdv` |
| D2 | Ayarlar penceresinde yatay kaydırma çubuğu çıkıyordu: Luca parola kutusu "göz" düğmesini pencere dışına itiyordu | `#lg_parola{flex:1;min-width:0}` (yalnız CSS) | `once/sonra-1280-06-ayarlar` |
| D3 | Muhasebe ekranları ile Mizan ve fatura kaydı panelleri sağda kaydırma çubuğu payının altına giriyordu; sağdaki düğmeler kenara yapışıktı ("PDF Yazdır", "Listeyi Excel'e Aktar") | Sabit paneller sayfa içeriğiyle aynı sağ kenarda bitiyor (`sagPay`) | `once/sonra-1280-14-kdv`, `-13-fis-listesi` |
| D4 | 1024 px'te üst şerit iki satıra iniyordu (Tema ve Ayarlar alt satırda) | ≤1280 px'te "Ara" düğmesindeki `Ctrl+K` ipucu gizli ve düğme iç boşlukları küçük; ≤1100 px'te firma seçimi 170 px. 1024 px'te şerit tek satır | `once/sonra-1024-02-banka` |
| D5 | Kural formunda etiket içindeki açıklama büyük harfe çevriliyordu ("(\| = YA DA · + = HEPSİ GEÇMELİ)") | Etiket içindeki açıklama normal yazılıyor | `once/sonra-1280-04-kural-ekle` |
| D6 | Aynı işi yapan düğmeler farklı fiil kullanıyordu: "Mizanı Luca'dan **Çek**", "Tümünü Luca'dan **Çek**", ama Firma ayarlarında "Luca'dan **yenile**" ve Fiş Listesi'nde "Muavini Luca'dan **Yenile**" | Hepsi "… Luca'dan Çek" oldu: Firma ayarları "Mizanı Luca'dan Çek", Fiş Listesi "Muavini Luca'dan Çek" | `sonra-1280-13-fis-listesi` |

Notlar:
- Yazım ve büyük/küçük harf tutarlılığı: düğme, sekme ve etiketlerde her sözcüğün büyük harfle başlaması programdaki "Başlık Biçimi" kodu tarafından zaten sağlanıyor. Taramada bu kurala aykırı düğme görülmedi.
- Ölçüm sonucu: 1280 ve 1024 px'te hiçbir ekranda sayfa yatay kaydırması yok; düğme yazısı iki satıra kırılan düğme yok.

### Öneriler (büyük ya da zevke bağlı; kullanıcı seçsin, uygulanmadı)
| # | Öneri | Neden |
|---|---|---|
| Ö1 | **Muhasebe alt sekmeleri** (Toplu Kontrol … KDV) Banka'daki "Banka Ekstreleri / Kredi Kartı Ekstreleri" sekmeleri gibi alt çizgili sekme görünümüne geçsin | Bugün üç farklı sekme görünümü var: modül sekmeleri (hap), Banka alt sekmeleri (alt çizgi), Muhasebe alt sekmeleri (çerçeveli düğme). Tek görünüm daha düzenli olur. |
| Ö2 | Düğme yükseklikleri iki boya insin: normal **34 px**, küçük **28 px** | Belgeden Fiş araç çubuğunda **30 px** düğmeler var (`sonra-1280-09-belgeden-fis`). Öteki ekranlar 34 / 28 px. |
| Ö3 | Belgeden Fiş başlık satırı: açıklama metni başlığın altına alınsın | 1024 px'te "Luca'ya Kaydet" alt satıra iniyor (`sonra-1024-09-belgeden-fis`). |
| Ö4 | Boş liste mesajları tek biçimde yazılsın: ortada, eğik değil, bir sonraki adımı söyleyen tek cümle | Bugün "Fiş yok" (çok kısa), "Bu firmanın kontrol edilmiş dönemi yok." (eğik, Fatura Kontrol sayfası), "Henüz ÖKC fişi yok. 'Görüntü ekle' ile …" (uzun) gibi farklı biçimler var. |
| Ö5 | "Mizanları Güncelle" penceresi, Luca bağlı değilken kendi "Luca'yı Aç" düğmesini göstermesin; üst şeritteki Luca düğmesine yönlendirsin | Görev 01'deki "tek Luca giriş düğmesi" kuralıyla çelişiyor (`sonra-1280-07-luca-mizan`). **Görev 18 (Yazılımcı, Luca düğmeleri) kapsamına giriyor**, çakışmasın diye dokunulmadı. |
| Ö6 | Fiş Listesi boşken tablonun yatay kaydırma çubuğu gizlensin | Liste boşken de alt kaydırma çubuğu görünüyor (`sonra-1280-13-fis-listesi`). |
| Ö7 | Fiş Girişi ve Fiş Listesi'ndeki "Üstten firma seçin" uyarısı, örnek firma seçiliyken "Örnek firmada kullanılamaz; Ayarlar › Firmalar'dan firma ekleyin" desin | Üstte "Örnek Firma" seçili görünürken "Üstten firma seçin" demek kafa karıştırıyor. |

## Değişen dosyalar
- `test/e2e.js`: oynak adım; yalnız beklemeler değişti.
- `renderer/style.css`: D1, D2, D4 ve D5.
- `renderer/index.html`:
  - `sagPay` ve `place` / `UstPanel` sağ kenarı (D3)
  - iki düğme adı (D6)
  - Luca giriş kutusu bölümüne **dokunulmadı** (G18 ile çakışmasın diye D2 CSS ile yapıldı)
- `yonetim/raporlar/rapor-24.md` ve `yonetim/raporlar/rapor-24/*.png` (19 görüntü, yaklaşık 2 MB)

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **283 ✓, 0 başarısız.** Oynak adım geçti: "Hesap 320.01 ABC LTD".
- `node test/mobil.js`: **45/45.**

## Devir notu
G24 tamam. Ö1–Ö7 kullanıcı kararı bekliyor. Ö5 G18 ile birlikte ele alınmalı.
