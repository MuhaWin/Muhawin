# Luca akış haritası (16.10.2026 ekran kayıtlarından)

## 1. Giriş
1. `https://www.luca.com.tr` → sağ üst **Sistem Giriş**.
2. Açılır pencere: `agiris.luca.com.tr/LUCASSO/giris.erp`
   - Üye Numarası, Kullanıcı Adı, Parola → **GİRİŞ**
   - İki aşamalı doğrulama kapalıysa **captcha** istenir → **Tamam**
3. `agiris.luca.com.tr/LUCASSO/main.erp` → **LUCA MALİ MÜŞAVİR PAKETİ** kutusu.
4. Program: `auygs.luca.com.tr/Luca/luca.do`
   - Doğrudan bu adrese gidilirse "Lütfen www.luca.com.tr adresinden giriş yapınız" hatası verir.

**Otomasyon kararı:** Kullanıcı Ayarlar'a Luca bilgilerini girip "otomatik giriş"i açarsa program üye no,
kullanıcı adı ve parolayı doldurup GİRİŞ'e basar ve "LUCA MALİ MÜŞAVİR PAKETİ"ni açar. **Captcha'yı program
çözmez/doldurmaz**: kutuya odaklanır, kullanıcı kodu yazıp Enter'a basar. Parola yalnız bu bilgisayarda,
Windows DPAPI ile şifreli saklanır. Bilgi girilmezse giriş tamamen elle yapılır; program `luca.do` açılınca devreye girer.

## 2. Firma ve dönem seçimi
- Sağ üstte iki açılır liste var:
  - **Firma** (ör. "EXPO İNŞ"; kısa adlar alfabetik)
  - **Dönem** (ör. "01/01/2026 - 31/12/2026")
- Seçimden sonra üst bilgide şu metin görünür: "Şu an EXPO İNŞAAT … şirketinin 01/01/2026-31/12/2026 döneminde çalışıyorsunuz! Vergi No: 3810463613". Firmanın doğru seçildiği bu VKN'den doğrulanabilir.

## 3. e-Belge indirme (her tür için aynı ekran)
Menü yolu: **Muhasebe → Akıllı Entegrasyon Noktası →** şu alt menülerden biri:

| Alt menü | Kullanım |
|---|---|
| e-Fatura Alış Faturaları | gelen e-fatura |
| e-Fatura Satış Faturaları | giden e-fatura |
| e-Arşiv Alış Faturaları | gelen e-arşiv |
| e-Arşiv Satış Faturaları | giden e-arşiv |
| GİB e-SMM Satış / Alış | serbest meslek makbuzu |

Bu menüde ayrıca İşNet, TÜRMOB, QR, NetteCap vb. kalemler var; onlar kullanılmayacak.

Ekran başlığı: "GİB E-Belge Entegrasyonu Alış/Satış Faturaları". Ekranda Belgeler ve Taslak Fişler sekmeleri var. Tablonun sütunları:
- Karşı Belge Türü
- Belge Numarası
- VKN/TCKN
- Ünvan
- Belge Tarihi
- Onay Durumu
- Muhasebe Fiş No

Alt çubuktaki düğmeler: Belge Ara · **GİB'den Getir** · **Seçilenleri İndir** · Yenile · Excel · GİB'den İptal/İtiraz Sorgula · Belge Sil · Muhasebe İptal · Belge Seç · Muhasebeleştir

Adımlar:
1. **GİB'den Getir** → "İNDİR" penceresi açılır: Tarih Aralığı (başlangıç–bitiş) ve isteğe bağlı "gece otomatik sorgula" kutusu → **Belgeleri Getir**.
2. "İşlem Takip" penceresi açılır. Luca, GİB'i gün gün sorgular ("Belgeler sorgulandı (15/09/2026)") ve sonunda "[OK] n adet belge kaydı bulundu" yazar. Belge olmayan günler için kırmızı uyarılar normaldir. Pencere **Kapat** ile kapatılır.
   - Faturalar entegratörden değil **GİB e-Belge servislerinden** geliyor. Bu yüzden müşteri hangi entegratörü kullanırsa kullansın (Paraşüt, Logo, Mikro…) faturalar buraya düşer.
3. Liste başlığındaki onay kutusuyla **tümünü seç** → **Seçilenleri İndir** → ZIP dosyası (`<firma>-<GGAAYYYY>.zip`) indirilir.

**Asla tıklanmayacaklar:** Belge Sil, Muhasebe İptal, Muhasebeleştir, GİB'den İptal/İtiraz Sorgula.

## 4. Muavin defter
Sağ paneldeki yol: **Defterler → Tüm Yazıcılar → Muavin Defter**. Üstteki "Nokta Vuruşlu Yazıcılar" altındaki kullanılmayacak.

Form alanları:

| Alan | Değer |
|---|---|
| Başlangıç / Bitiş Fiş Tarihi | boş (tüm yıl) ya da kontrol dönemi |
| Başlangıç Hesap Kodu | `100` |
| Bitiş Hesap Kodu | `999` |
| Fiş Tipi | Tümü |
| Sıralama Tipi | Giriş Sırasına Göre Sıralı |
| Bakiyesiz ve Çalışmayan Hesaplar | Bakiyesiz Hesapları Gösterme |
| Alanlar | Tek Satırda Göster Uzun Kesimi Kes |
| **Rapor Türü** | **Excel Liste (xlsx)** |

Sağ alttaki **Rapor** düğmesine basılır. "Rapor Takip" penceresinde "Rapor talebi başarıyla alındı" yazar, ardından `muavin_<firma>.xlsx` indirilir.

## Teknik yapı (16.10.2026 kayıt aracı çıktısından)

Program sayfası (`luca.do`) çerçevelerden (frame) oluşur:

| Frame | Adres | İçerik |
|---|---|---|
| frm1 | headerFrame.do | üst başlık |
| frm2 | menu.do | ana menü (Muhasebe = `td#apy1000m0i0ITD`) |
| frm3 | değişken | **çalışma alanı**; açılan ekranlar buraya yüklenir |
| frm4 | TopFrameAction.do | **firma/dönem seçimi** |
| frm5–7 | yardımcı | yevmiye/mal-hizmet/alt hesap listeleri |

**Firma seçimi (frm4):**
- `select#SirketCombo`; seçenek değeri = SIRKET_ID, metni = kısa ad (ör. "EXPO İNŞ").
- Seçimden sonra `td#SirName` içindeki **Tamam** düğmesine basılır (`formSubmit(event, 0)`).
- frm4 adresi `TopFrameAction.do?SIRKET_ID=…&DONEM_ID=…&DONEM_TXT=01/01/2026 - 31/12/2026` olur.

**e-Belge ekranları (frm3):** Menüye gerek yok, ekran doğrudan adresle açılabilir: `gib530.do?tur=<tür>&c_musteri_id=<üye no>`

| tür | ekran |
|---|---|
| `gib_efatura_alis` / `gib_efatura_satis` | e-Fatura alış / satış |
| `gib_ebelge_alis` / `gib_ebelge_satis` | e-Arşiv alış / satış |
| `gib_esmm_alis` / `gib_esmm_satis` | e-SMM |

Sayfadaki değişkenler: `sirket_id`, `donem_id`, `kisa_ad`, `menu_tur`. Bunlarla doğru firmada olunduğu doğrulanabilir.

**Düğmeler:**

| Düğme | Seçici / çağrı |
|---|---|
| GİB'den Getir | `button.gib_530-item` (görünür olan) → `gonder('indir-window')` |
| Tarih alanları | `#tarih1`, `#tarih2` (GG/AA/YYYY) |
| Belgeleri Getir | `#faturalari-getir-btn` → `gonder('indir')` |
| İşlem Takip penceresi | `div#luca-board` içinde **Kapat** |
| Tümünü seç | `input.hepsi` (`.tab-1 .sec` kutularını işaretler) veya `#tum_belgeyi_sec_btn` |
| Seçilenleri İndir | `gonder('zip-window')` → pencerede `#zip-btn` (`gonder('zip')`); dosya `gib530/<tür>.jq` isteğiyle iner (`<kısa ad>-<GGAAYYYY>.zip`) |
| Asla dokunulmayacak | `#sil-btn`, `#muhasebe-iptal-btn`, `#muhasebelestir-btn`, `#fis-kes-btn` |

**Muavin:** Sağ paneldeki (frm5) "Muavin Defter" bağlantısı ya da doğrudan `raporMizanDetayHazirla.do?c_musteri_id=<üye no>` (frm3). Nokta vuruşlu sürüm `raporMuavinKarakter.do`'dur ve kullanılmayacak.

Form alanları:
- `#hesap_kodu_ilk` = 100, `#hesap_kodu_son` = 999
- Fiş tarihleri boş bırakılır (tüm yıl)
- Rapor Türü varsayılan olarak "Excel Liste (xlsx)"; otomasyon yine de "Rapor Türü" satırındaki listeden bunu seçecek
- **Rapor** düğmesi: `button.green.bold` (`gonder()`)
- Dosya, Rapor Takip penceresinden sonra `genel/rapor_indir.jq` ile iner (`muavin_<kısa ad>.xlsx`)

**Doğrulama (16.10.2026):** Kayıt aracının indirdiği ZIP (108 fatura) ve muavin, kontrol motoruna doğrudan verildi. Sonuç, elle indirilen dosyalarla alınan sonuçla aynı çıktı.

**Güvenlik notu:** Luca, e-belge ekranının HTML'ine mükellefin GİB kullanıcı kodu ve şifresini (`#gib_kullanici_adi`, `#gib_sifre`) ve entegratör bilgilerini gömülü gönderiyor. Kayıt aracı bu alanların değerlerini artık siliyor (`gizle()`). Otomasyon bu alanları hiçbir zaman okumayacak.

## Açık noktalar
- "Tümünü seç" listedeki **tüm** belgeleri seçiyor (yıl başından beri). Dönem süzgeci (Belge Ara → `#baslangic`/`#bitis`) sonraki sürümde eklenecek; şimdilik süzme işini kontrol motoru yapıyor.
- Dönem yıl değiştirirken (Ocak kontrolünde önceki yıl) davranış.
