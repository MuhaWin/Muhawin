# Fatura – Muavin Kontrol

e-Fatura / e-Arşiv XML'lerini Luca muavin dökümüyle karşılaştırır ve rapor üretir.

## Program (masaüstü) – önerilen kullanım

**Kurulum (bir kez):** `kurulum.bat` dosyasına çift tıklayın. Paketleri kurar ve masaüstüne
**Fatura Kontrol** simgesini koyar. (Python 3.11+ gerekir.)

**İlk açılış:** **Ayarlar** sekmesinde kullanıcı / büro bilgilerinizi girin. İsterseniz Luca üye no, kullanıcı adı
ve parolanızı da yazıp "otomatik giriş"i açın: program bunları doldurur, siz yalnız doğrulama kodunu (captcha)
yazarsınız. Parola bu bilgisayarda Windows şifrelemesiyle saklanır; yazmazsanız giriş elle yapılır.

**Kayıt bildirimi:** Ayarlar'daki kullanıcı/büro bilgileri kaydedilince (ve değiştikçe) program sağlayıcısına
e-posta ile iletilir (şifresiz form servisi; adres `fatura_kontrol\kayit_bildirim.json`). Luca giriş bilgileri
gönderilmez. İnternet yoksa program bir sonraki açılışta yeniden dener. FormSubmit ilk bildirimde alıcı adrese
bir etkinleştirme e-postası yollar; bağlantıya bir kez tıklamak gerekir.

**Verilerin yeri:** her firma için `veri\firmalar\<FİRMA>\<YIL>\<AY>` klasörü (indirilen belgeler, muavin,
kontrol raporu). Aynı firma ve ay yeniden sorgulanınca önceki dosyalar silinir, yenileri yazılır. Toplu
özetler `veri\toplu\<YIL-AY>` klasöründedir. Bu sürüm ilk açıldığında önceki sürümlerin dağınık verilerini
bir kez siler. Ayarlar → *Tüm sorgu sonuçlarını sil* ile istediğiniz zaman temizleyebilirsiniz.

**Luca penceresi açık kalır:** sorgu bitince Luca'nın açıldığı Chrome kapanmaz; sonraki sorgu (yenileme,
başka firma, firma listesi) aynı oturumu kullanır, yeniden giriş gerekmez. Luca oturumu zaman aşımına uğrarsa
program girişi yeniden ister. Bu pencereyi siz kapatırsanız bir sonraki sorguda yenisi açılır.

**Dövizli faturalar:** KDV'nin TL karşılığı şu sırayla aranır: (1) faturada TL olarak yazılmış vergi tutarı ya da
notlarda "KDV TL: …" gibi yazılmış TL KDV, (2) yoksa faturadaki kur × döviz KDV. Böyle faturalar karşılaştırılır ve
uyumluysa "Dövizli fatura (TL karşılığı) – uyumlu" kategorisinde görünür; Döviz sütununda TL'nin kaynağı yazar.
Ne TL tutar ne kur varsa "Dövizli fatura (kontrol dışı)" olarak listelenir.

**Faturalar bir kez saklanır:** Luca'dan inen ZIP'ler açılır, her fatura kendi tarihinin ayındaki
`faturalar.zip` arşivine bir kez yazılır (aynı fatura tekrar gelirse yazılmaz), ham ZIP'ler silinir.

**Rapor ekranı:** sütun başlığına tıklayınca sıralanır (tekrar tıklayınca ters), başlıkların altındaki kutularla
sütun sütun filtrelenir. Satır başındaki 📄 faturayı GİB görünümüyle açar (Yazdır → PDF olarak kaydet).
Sağ üstteki *Fatura klasörünü aç* o firma-ayın klasörünü açar.

**Binek araç:** faturanın fişinde adında "Binek" geçen bir hesap varsa KDV'nin %70'i beklenir; bu faturalar
"Binek araç (%70 KDV) – uyumlu / fark" kategorilerinde ayrıca gösterilir.

**Fatura tipi ve istisnalar:** raporda her faturanın tipi ve KDV istisna gerekçesi yazar (ör. "İhraç kayıtlı · 701 - …",
"İhracat (İstisna) · 301 - Mal ihracatı"). İhraç kayıtlı faturada hesaplanan KDV tahsil edilmediği için muavinde KDV
yoksa "İhraç kayıtlı (KDV tahsil edilmedi) – uyumlu"; KDV'siz istisna faturaları "İstisna (KDV yok) – uyumlu"
kategorisindedir. GİB 351 ("istisna olmayan diğer") istisna sayılmaz.

**Sadece muavin:** Sonuçlar'daki bu düğme faturaları yeniden indirmeden yalnız muavini indirip kontrolü yeniler.

**Bozuk paket:** Luca bir faturayı bulamayıp ZIP'i yarım bırakırsa diğer faturalar tek tek kurtarılır, eksik
belge rapora uyarı olarak yazılır.

**Görünüm:** Ayarlar → Görünüm'den tema seçilir (Lacivert, Gece/koyu, Orman, Bordo, Grafit).
Sonuçlar ve KDV2 Raporu sekmelerinde sağ üstteki **Dönem** listesinden aylar arasında geçilir.

**Kullanım:** masaüstündeki **Fatura Kontrol** simgesine çift tıklayın. Program kendi penceresinde açılır
(siyah konsol penceresi yoktur).

- **Firmalar** sekmesi: *Luca'dan listeyi çek / yenile* → açılan Chrome'da Luca'ya girin; firma listesi gelir.
  Kontrol edilmeyecek firmaların işaretini kaldırın, not yazın, **Kaydet**.
- Sol taraftan **ayı** seçip **Toplu kontrolü başlat** → Chrome açılır, Luca'ya bir kez girin; program
  firmaları sırayla işler. Sol altta canlı ilerleme görünür (hangi firma, hangi adım). 3 dakikadan uzun
  ilerleme olmazsa uyarı verir (Luca'da açık kalan bir uyarı kutusu olabilir).
- **Sonuçlar** sekmesi: firma başına durum, sorun sayıları, *Raporu aç*, *Yeniden çalıştır*;
  *Hatalıları yeniden çalıştır* yalnız hatalı firmaları aynı çalışmaya ekler. *Özet Excel'i indir*.
  Özet her firmadan sonra güncellenir; yarıda kalan çalışmada da bulunur.
- **İşlem özeti** (sol alt): her firma için 6 e-belge türü ve muavin ✓ tamamlandı · – belge yok · ✗ hata ·
  ◐ yarım · ○ yapılmadı olarak listelenir. Eksik adımın yanındaki **Tekrar sorgula** yalnız o adımı
  yeniden dener; diğer adımlarda indirilen dosyalar korunur ve firmanın kontrolü tüm dosyalarla yeniden yapılır.
- **KDV2 Raporu**: o ayda tevkifatlı alış faturası olan tüm firmalar, firma firma: tarih, belge no, satıcı,
  matrah, KDV, tevkifat kodu ve türü, oran (ör. 2/10) ve tevkif edilen KDV; firma ve genel toplamlar.
  *Excel'e aktar* ile indirilir; toplu özet Excel'inde de ayrı sayfa olarak bulunur. Sonraki aya ait faturalar hariçtir.
- Tek firma raporunda da **KDV tevkifatı (KDV2)** sekmesi ve Excel'de **KDV Tevkifatı** sayfası vardır (alış ve satış).
- **Aylık geçmiş**: önceki ayların toplu kontrolleri.
- *Tek firma / dosyadan kontrol*: elle yüklenen XML/ZIP ve muavinle kontrol (eski ekran).

Program penceresi kapatılırsa çalışan toplu kontrol bitene kadar arka planda sürer.
Günlük: `veri\program.log`, her çalışmanın ayrıntısı `veri\toplu\<ay>_<zaman>\gunluk.txt`.

## Web arayüzü (Faz 2 – pilot)

**Windows:** klasördeki `baslat.bat` dosyasına çift tıklayın. İlk çalıştırmada gerekli paketler
kurulur (Python 3.11+ gerekir), ardından tarayıcıda `http://127.0.0.1:8000` açılır.

**Diğer:** `pip install -r requirements.txt` ve `python -m fatura_kontrol.web`

Kullanım:
1. e-Fatura ZIP/XML dosyalarını ve Luca muavin Excel'ini yükleyin (sürükle-bırak olur).
2. Dönemi seçin (varsayılan geçen ay). VKN boş bırakılırsa faturalardan bulunur.
3. **Kontrol et** → durum kutularına tıklayarak filtreleyin, arayın, Excel raporunu indirin.
4. **Geçmiş kontroller** ile önceki raporları tekrar açın.

Program yalnızca bu bilgisayardan erişilir (127.0.0.1); dosyalar internete gönderilmez.
Raporlar ve geçmiş, programın çalıştığı klasördeki `veri` klasöründe saklanır.

## Luca otomasyonu (Faz 3)

1. `baslat.bat` ile web arayüzünü açın (rapor burada açılacak).
2. `luca_otomasyon.bat` dosyasına çift tıklayın. Firma kısa adını (Luca'daki gibi, ör. `EXPO İNŞ`) ve ayı (ör. `2026-09`) yazın.
3. Açılan Chrome'da Luca'ya kendiniz giriş yapın (şifre ve captcha). Program, Luca ekranı açılınca devreye girer:
   - firmayı (ve gerekirse dönem yılını) seçer, Luca'nın gösterdiği VKN'yi okur;
   - e-Fatura, e-Arşiv ve e-SMM alış/satış ekranlarında sırayla **GİB'den Getir → Tümünü seç → Seçilenleri İndir** yapar (sayfa sayfa);
   - **Muavin Defter**'i (100–999, Excel Liste) indirir;
   - kontrolü çalıştırır ve raporu web arayüzünde açar.
4. Bir adım başarısız olursa diğerlerine devam edilir; hata raporun uyarılarında ve `veri/luca_indirmeler/...` klasöründe (ekran görüntüsüyle) görünür.

**Güvenlik:** Belge Sil, Muhasebeleştir, Muhasebe İptal, Fiş Kes, İptal/İtiraz düğmelerine program hiçbir koşulda basmaz (her tıklama yasak listesine karşı denetlenir). Luca şifreniz programa girmez.

Komut satırı: `python -m fatura_kontrol.luca.otomasyon --firma "EXPO İNŞ" --ay 2026-09 [--turler gib_efatura_alis,gib_efatura_satis]`

## Toplu (çok firmalı) çalıştırma

1. **İlk kurulumda bir kez:** `luca_firma_listesi.bat` → Luca'ya girin; program sağ üstteki firma listesinin tamamını
   `veri\firmalar.xlsx` dosyasına yazar ve açar. Kontrol **edilmeyecek** firmaların **Dahil** sütununa `H` yazıp kaydedin.
   Listeyi sonradan yenilerseniz eski E/H seçimleriniz ve notlarınız korunur, yeni firmalar `E` gelir.
2. **Her ay:** `luca_toplu.bat` → ayı yazın (ör. `2026-09`) → Luca'ya bir kez girin. Program Dahil=E olan her firmayı
   sırayla işler (firma seçimi, 6 e-belge türü, muavin, kontrol).
3. Sonunda `veri\toplu\<ay>_<zaman>\toplu_ozet.xlsx` açılır: firma başına durum (Hata / Sorun var / Belgesiz / Temiz),
   sorun sayıları ve firmanın ayrıntılı raporuna bağlantı. Raporlar web arayüzünün **Geçmiş** listesinde de görünür.

Bir firmada hata olursa diğerlerine devam edilir. Luca oturumu düşerse program yeniden girişinizi bekler.

## Luca kayıt aracı (keşif)

`luca_kayit.bat` dosyasına çift tıklayın. Chrome (yoksa Edge) ayrı bir profille açılır.
1. Luca'ya her zamanki gibi giriş yapın: üye no, kullanıcı adı, şifre ve captcha. **Giriş ekranları kaydedilmez.**
2. Firmayı seçin, e-fatura ve e-arşiv indirmelerini ve muavin raporunu normalde yaptığınız gibi yapın.
3. Tarayıcıyı kapatın. `luca_kayitlari` klasöründe bir ZIP oluşur; bu ZIP'i gönderin.

ZIP'te şunlar bulunur: tıklama ve form olayları (`olaylar.jsonl`), her tıklamada ekran görüntüsü,
sayfa yapısı (iframe HTML'leri) ve indirilen dosyalar. Parola alanları her durumda atlanır.
Akışın özeti: `docs/luca_akis.md`.

## Komut satırı (Faz 1)

```
python -m fatura_kontrol --vkn 3810463613 ^
    --fatura expo_ins-16102026.zip ^
    --muavin muavin_191.xlsx --muavin muavin_391.xlsx --muavin muavin_600.xlsx ^
    --bas 01.09.2026 --bit 30.09.2026 ^
    --cikti kontrol_raporu.xlsx
```
- `--fatura`: XML, ZIP (iç içe ZIP dahil) veya klasör; birden fazla verilebilir.
- `--muavin`: Luca "Muavin Defter" Excel dökümü; birden fazla verilebilir.
- `--bas/--bit` verilmezse kontrol aralığı yüklenen faturaların ilk–son tarihidir.
- `--tolerans`: kuruş farkı toleransı (varsayılan 0,05 TL).

## Yapılan kontroller (yüklenen muavine göre otomatik seçilir)
Hesap planından bağımsızdır: faturanın belge numarasıyla kaydedildiği fişe bakılır.

Şu an yalnız **KDV** karşılaştırılır: alış faturalarının KDV'si **191**, satışlarınki **391** hesabıyla, oran bazlı
(her oran kendi alt hesabında mı). Muavin yine tüm hesaplarla (100–999) indirilir; böylece faturanın hiç
kaydedilmediği ("Muavinde yok") ya da yanlış dönemde kaydedildiği de tespit edilir. Matrah ve fiş toplamı
kontrolleri kapalıdır (`eslestirme.AKTIF_KONTROLLER`).


## Rapordaki durumlar
Uyumlu · KDV'siz fatura · Dönem dışı fatura · Küçük fark (≤1 TL) · Sonraki dönemde kayıtlı ·
Fatura tarihinden önce kaydedilmiş · Tutar farkı · Yanlış KDV oranı hesabı · Mükerrer kayıt ·
Belge no farklı yazılmış olabilir · Muavinde yok · Faturası bulunamadı

## Varsayımlar
- Luca açıklaması `GG/AA/YYYY-BELGENO-ÜNVAN` biçiminde.
- KDV oranı alt hesap adındaki `%1 / %10 / %20` ifadesinden okunur.
- Belge no 16 haneli GİB formatına uymayan kayıtlar (Z raporu, tahakkuk, kâğıt belge) "Fatura dışı" sayılır.

## Test
```
python -m pytest tests
```
