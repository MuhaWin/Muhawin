# Rapor 25 – Arayüz düzeni (rapor-24 önerileri Ö1, Ö2, Ö3, Ö4, Ö6, Ö7)

**Durum:** Yapıldı. İşçi oturumu: **Menü Düzenleme**. Dal: `claude/affectionate-darwin-effcgp` (`main` birleştirildi). Ö5 Görev 18'e (Yazılımcı) verildi; bu görevde ona dokunulmadı.
Ekran görüntüleri `yonetim/raporlar/rapor-25/` klasöründe: `once-*` değişiklikten önce, `sonra-*` sonra. 1280 ve 1024 px.

## Yapılanlar
| # | Öneri | Uygulama | Görüntü |
|---|---|---|---|
| Ö1 | Tek sekme görünümü (alt çizgili) | Ayrıntılar aşağıda. | `-02-banka`, `-08-muavin`, `-13-fis-listesi`, `-14-kdv` |
| Ö2 | Düğme boyları 34 / 28 px | Bar içindeki süzgeç düğmeleri (Belgeden Fiş: ÖKC Fişleri / Kayıtsız / Tümü …; fatura kaydı süzgeçleri) 30 px'ten 34 px'e çıktı. Tarama ölçümünde Belgeden Fiş ekranındaki tüm düğmeler 34 px (önce 12 düğme 30 px'ti). Ekranlarda yalnız 34 px (normal) ve 28 px (küçük) var. | `-09-belgeden-fis` |
| Ö3 | Belgeden Fiş başlık düzeni | Açıklama metni başlığın altına indi; "Excel'e Aktar" ve "Luca'ya Kaydet" başlık satırında kaldı. Dar ekranda düğmeler artık alt satıra düşmüyor. Aynı düzen Çek / Senet başlığında da var. | `1024-09-belgeden-fis` |
| Ö4 | Boş liste mesajları tek biçim | Ayrıntılar aşağıda. | `-08-mizan`, `-13-fis-listesi` |
| Ö6 | Liste boşken yatay kaydırma çubuğu gizli | Liste boşken tablo kabının yatay kaydırması kapalı ve tablo en küçük genişliğe zorlanmıyor (`.mmwrap:has(td.bosliste)`). Fiş Listesi ile Mizan / Muavin / Hesap Planı boşken alt kaydırma çubuğu yok. | `-13-fis-listesi`, `-08-muavin` |
| Ö7 | Örnek firma uyarısı | Örnek firma seçiliyken "Üstten firma seçin" yerine "Örnek firmada kullanılamaz — Ayarlar › Firmalar'dan firma ekleyin" yazıyor (`firmaYokUyari`). Etkilenen yerler: Fiş Girişi rozeti, Fiş Listesi uyarısı, şablon / Luca kayıt iletileri. Gerçek firma yokken eski ileti duruyor. | `-12-fis-girisi`, `-13-fis-listesi` |

### Ö1 – tek sekme görünümü
Programdaki tüm sekme satırları artık alt çizgili:
- seçili sekme vurgu renkli yazı ve alt çizgiyle gösteriliyor
- diğer sekmeler gri yazılı, üzerine gelince açık zeminli

Değişen sekme satırları:
- modül sekmeleri (Banka · Muhasebe · Belgeden Fiş): önce hap biçimindeydi
- Muhasebe alt sekmeleri (Toplu Kontrol … KDV): önce çerçeveli düğmeydi
- Mizan / Muavin / Hesap Planı sekmeleri: önce dolgulu düğmeydi

Zaten bu biçimde olanlar:
- Banka › Banka Ekstreleri / Kredi Kartı Ekstreleri
- pencere sekmeleri (Kural Ekle / Kural Listesi)
- Fatura Kontrol sayfalarının iç sekmeleri

Kayıtsız / Tümü gibi **süzgeç** düğme grupları sekme değil, seçim düğmesi olduğu için dolgulu kaldı.

### Ö4 – boş liste mesajları
Tüm boş tablolar ortak `bosliste` biçimini kullanıyor: ortada, düz (eğik değil), gri yazı, bir sonraki adımı söyleyen tek cümle.

Metni değişen mesajlar:
- Fiş Listesi: "Fiş yok" → "Bu tarih aralığında fiş yok. Tarih aralığını genişletin ya da muavini Luca'dan çekin."
- Mizan / Muavin / Hesap Planı: "Kayıt yok" → "Bu görünümde kayıt yok. Süzgeçleri temizleyin ya da Luca'dan çekin."
- Fatura kaydı: "Fatura yok." → "Bu filtrede fatura yok. Başka bir süzgeç seçin."
- Banka: "Bu filtrede hareket yok." → "… Başka bir süzgeç seçin."

Ayrıca Fatura Kontrol sayfalarının boş liste biçimi (`tema.css` `.bos`) eğik yazıdan düz yazıya geçti.

## Değişen dosyalar
- `renderer/style.css`: Ö1, Ö2, Ö3, Ö4, Ö6; ayrıca 1024 px'te firma seçimi 190 px oldu (rapor-24'te 170 px'ti; firma adı kesiliyordu).
- `renderer/index.html`:
  - `firmaYokUyari` ve 4 kullanım yeri (Ö7)
  - 6 boş liste mesajı (Ö4)
- `fk/fatura_kontrol/web/static/tema.css`: yalnız `.bos` satırı (Ö4)
- `yonetim/raporlar/rapor-25.md` ve `yonetim/raporlar/rapor-25/*.png`

## Testler (Linux, xvfb; derleme yok)
- `xvfb-run -a node test/e2e.js`: **283 ✓, 0 başarısız.**
- `node test/mobil.js`: **45/45.**
- Tarama (1280 / 1024 px; 16 ekran): sayfa yatay kaydırması yok, taşan düğme yok, iki satıra kırılan düğme yok. Görev 17'deki "üst şerit her ekranda aynı yerde" e2e denetimi de geçiyor.

## Riskler
- Sekme görünümü değişikliği yalnız CSS. Seçili durum yine `aria-selected` / `aria-pressed` ile belirleniyor; testler ve ESC davranışı etkilenmedi.
- `:has()` seçicisi Electron 31'de (Chromium 126) destekli.

## Devir notu
G25 tamam.
