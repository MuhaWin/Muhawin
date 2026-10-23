# MuhaWin için Luca odaklı modül araştırması ve öneriler

**Özet:** Luca'nın geniş bir ürün ailesi var (MMP, Net, Koza, Denetim, Rota, e-Belge). En çok şikayet edilen konular e-Arşiv faturaların çekilememesi, e-Defter beratının gönderilememesi veya yavaş gitmesi, ekstre aktarımının eksik kalması, program yavaşlığı ve desteğe ulaşılamaması. Mevzuat tarafında üç değişiklik planı doğrudan etkiliyor:
- **Ba-Bs formları kaldırıldı** (Eylül 2024 dönemi ve sonrası). Ba-Bs modülü yapmayın.
- **Enflasyon düzeltmesi 2025-2027 için ertelendi.** Düşük öncelikli.
- **KDV beyannameleri kademeli olarak Dijital Vergi Dairesi e-Beyan'a geçiyor.** Antalya 2026/Mayıs döneminden beri kapsamda. Mevcut KDV beyanname taslağı modülünü doğrudan etkiliyor.

Ayrıca GİB'in **KURGAN** sahte belge risk analizi 01.10.2025'ten beri uygulanıyor. Bu, fatura modülünün üzerine kurulabilecek ve zamanında gelen bir fırsat.

---

## 1. Luca ürün ailesi ve modülleri (doğrulananlar)

Kaynaklar: [TÜRMOB e-İmza Luca broşürü](https://www.turmobeimza.com.tr/upload/docs/genel_brosur_luca.pdf), [Luca Net KOBİ dokümanı](https://luca.com.tr/Upload/TDC06tVS/y9P3/7OSi5gP6TbixpjI.pdf), [Luca Koza broşürü](https://luca.com.tr/Upload/UPm0BmiK/1GV9/dDib7ENdcMtELgc.pdf).

- **LUCA MMP (Mali Müşavir Paketi):**
  - Enflasyon muhasebesi (TÜİK katsayılarıyla), e-Defter hazırlama ve gönderme.
  - e-Beyanname'yi GİB'e "tek tuşla" gönderme.
  - Veri aktarımı: hesap planı, fiş, fatura, bordro, banka ekstresi, sabit kıymet, stok kartı.
  - Sabit kıymet ve amortisman; bordro, SGK ve gelir vergisi istisnaları.
  - Toplu kira kartı ve toplu beyanname.
  - BES bildirimi, AŞ genel kurul evrakları, silinen kayıtları geri alma.
- **Muhasebenews'teki Luca eğitim başlıkları** ([kategori](https://www.muhasebenews.com/category/luca/)): banka ekstresi CSV aktarımı, banka kural tanımlama, ekstreden fiş oluşturma, yansıtma, amortisman, sabit kıymet kartı, toplu stok, personel entegrasyonu, KDV, muhtasar, geçici vergi, enflasyon muhasebesi, Ba-Bs. Bunlar mali müşavirin Luca'da tekrar tekrar yaptığı rutin işlerin iyi bir göstergesi.
- **LUCA Net (KOBİ ticari):**
  - Excel'den cari, stok, fatura, yevmiye ve ekstre aktarımı.
  - Yazar kasa Z raporlarını ve perakende fişlerini toplu işleme.
  - e-Fatura ve e-Arşiv; MMP'ye yevmiye olarak aktarım; muhasebeleştirmeden mizan ve muavin alma.
- **LUCA Koza (kurumsal ticari):** Stok, finans, üretim. Broşüre göre REST API'si var (yalnız Koza için).
- **LUCA Denetim:** Denetim dosyası, risk anketi ve skorlama, kontrol testleri. Planladığınız "Denetim ve Analiz" modülüyle örtüşüyor.
- **LUCA Rota:** SGK teşvik kontrolü, tahakkuk ve hizmet listelerine erişim.
- **e-Belge ürünleri:** e-Fatura, e-Arşiv, e-İrsaliye, e-MM, e-SMM.
- **Banka entegrasyonu:** Kuveyt Türk ile resmi "Luca Banka Hesap Hareketleri Entegrasyonu" var ([kaynak](https://www.kuveytturk.com.tr/en/business/cash-management/e-services-and-accounting-management/turmob-luca-bank-account-activity-integration)). Bazı bankalar için Ekstre modülünün doğrudan rakibi.
- **LUCA NETONE:** TÜRMOB'un 29.06.2026 tarihli webinar gündeminde geçiyor ([kaynak](https://www.turmob.org.tr/haberler/83cb1f6e-3473-48ee-b441-e7f9d93eeaf9/dijital-vergi-dairesi--e-beyan-ve-e-donusum-gundemi-webinari---29-haziran-2026)). Aynı webinarda Luca üzerinden e-Beyan pilotunda KDV beyanı da işleniyor. NETONE'un içeriği doğrulanamadı.
- **Doğrulanamayanlar:**
  - Brifte geçen "Luca Akıllı Entegrasyon Noktası" ve "Luca Konnektör" adlarına kamuya açık kaynakta rastlamadım.
  - Luca'nın resmi yardım veya destek dokümanlarına (ekran adları, Excel fiş şablonu) ulaşamadım.
  - Luca'nın e-Fatura'dan otomatik muhasebeleştirme yapıp yapmadığını kesinleştiremedim.

## 2. Şikayetler ve manuel iş yükü

Kaynaklar: [Şikayetvar Luca sayfası](https://www.sikayetvar.com/luca-muhasebe-sistemi), [Luca programı şikayetleri](https://www.sikayetvar.com/luca-muhasebe-sistemi/luca-programi).

- **e-Arşiv ve e-Fatura:**
  - GİB'den e-Arşiv satış faturaları çekilemiyor.
  - Luca Entegratör'de "Fatura bulunamadı" hatası alınıyor.
  - Chrome driver.exe hatası fatura kesimini engelliyor.
- **e-Defter:**
  - Berat gönderimi dakikalar yerine saatler sürüyor.
  - Bazı kullanıcılarda gönderim haftalarca başarısız olmuş.
- **Banka ekstresi:** Ziraat Katılım ekstresinde 100 satırdan yalnızca yaklaşık 20'si aktarılmış. Ekstre modülünüz için doğrudan bir değer önerisi.
- **Yavaşlık:**
  - Donma, otomatik oturum kapanması, mükerrer kayıt oluşması.
  - Bir kullanıcı günde yaklaşık 2 saat kaybettiğini yazıyor.
  - Not: Oturum düşmesi Playwright otomasyonunu da etkiler. Yeniden oturum açma ve kaldığı yerden devam etme şart.
- **Eksik özellik:** Luca Net'te yazar kasa modülü sorunlu veya eksik. Planladığınız ÖKC modülünü destekliyor.
- **Destek ve aktarım:** Desteğe ulaşılamıyor; firma aktarımlarında veri eksik geliyor.

## 3. Rakip ve benzer araçlar

| Araç | Ne sunuyor | Luca bağlantısı |
|---|---|---|
| [Hattat Müşavir](https://hattatmusavir.com/) | Her gece 15 sorgu (tebligat, beyanname, SGK, borç, e-Arşiv), eksik berat listesi, SGK teşvik, sahte belge sorgu, e-Defter kontrolü, ÖKC satış raporu, 60'tan fazla entegratörden fatura | Belirtilmemiş |
| [Uyumsoft MüşavirPro+](https://www.uyumsoft.com/musavir-pro-mali-musavir-yazilimi) ([haber](https://uyumsoft.com/haber/mali-musavirler-ekosmmm-ile-dijitallesiyor)) | Tahakkuk indirip WhatsApp ile gönderme, e-Arşivden fiş üretme, fişleri Defter Beyan ile kontrol, TCMB kurlarını otomatik alma, POS sorgu | Kendi programı (Luca'nın rakibi) |
| [Faturaport mali müşavir modülü](https://www.faturaport.com/mali-musavir-modulu) | Çok mükellefli e-Fatura paneli, toplu indirme, vergi ve istisna detaylı rapor | Luca ve Zirve'ye aktarım var |
| KolayBi'Link ([karşılaştırma](https://facit.app/mukellef-takip-programlari-mukellef-takibi/), [ürün](https://www.kolaybi.com/en/bilink)) | Ücretsiz mükellef portalı | Karşılaştırma yazısına göre Luca'ya fatura aktarımı var; ürün sayfasında doğrulanamadı |
| İSMMMO Beyanname Takip ([kaynak](https://www.ucretsizprogram.org/ucretsiz-e-beyanname-tahakkuk-ve-beyan-indirme-programi/)) | Ücretsiz; toplu beyanname ve tahakkuk indirme, verilmeyen beyanname listesi | Yok |
| Ofisyon, e-Mükellef, Mukellef.im ([facit karşılaştırması](https://facit.app/mukellef-takip-programlari-mukellef-takibi/)) | e-Tebligat ve beyanname takibi; yıllık yaklaşık 5.000–15.000 TL | Belirtilmemiş |
| [Logo Mali Müşavir 3](https://www.logo.com.tr/en/urun/logo-mali-musavir-3) | Faturadan toplu gelir/gider kaydı, görev zamanlayıcı, Defter Beyan entegrasyonu | Rakip program |

**Sonuç:** Beyanname, tahakkuk ve e-tebligat takibi pazarı kalabalık; ücretsiz alternatifler de var. Rakiplerde açıkça görünmeyen alan, **Luca içindeki muavin ve mizan verisiyle yapılan çapraz kontrol ve Luca'ya otomatik fiş yazmak**. MuhaWin'in farkı burada.

## 4. Dönemsel yükümlülüklerde güncel durum

- **Ba-Bs:** VUK 565 Sıra No.lu Tebliğ ile Eylül 2024 dönemi ve sonrası için kaldırıldı ([KPMG](https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/form-ba-ve-form-bs-uygulamasina-son-verilmesine-iliskin-vuk-tebligi-yayimlandi/2746), [alomaliye](https://www.alomaliye.com/2024/09/25/vergi-usul-kanunu-genel-tebligi-sira-no-565/)). Yerine cari mutabakat önerilebilir.
- **Enflasyon düzeltmesi:** 7571 sayılı Kanunla 2025, 2026 ve 2027 için yapılmayacak. Sürekli altın veya gümüş alım-satımı ya da imalatı yapanlar hariç ([EY](https://www.ey.com/tr_tr/insights/tax/2026-vergi-duzenlemeleri)).
- **KDV e-Beyan geçişi:** KDV1, KDV2, KDV2B, KDV4 ve KDV9015 kademeli olarak Dijital Vergi Dairesi e-Beyan'a taşınıyor. **Antalya 2026/Mayıs döneminden itibaren kapsamda**; 36 ilde daha 2026/Haziran döneminden itibaren ([duyuru](https://www.alomaliye.com/2026/06/18/kdv-beyannamelerine-iliskin-onemli-duyuru-4/), [Andersen](https://tr.andersen.com/tr/images/pdf/and_57-kdv-beyaninin-digital-vergi-dairesinden-verilmesi-uygulamasi-genisledi.pdf)).
  - Muhasebe programları web servisle entegre olabiliyor. Gerekli bilgiler "entegrasyon talebinde bulunan programlarla paylaşılmış".
- **Geçici vergi e-Beyan pilotu:** 2026/Temmuz-Eylül döneminden itibaren, yalnız 5 ilde. Antalya bu pilotta yok ([duyuru](https://www.alomaliye.com/2026/09/01/gelir-ve-kurum-gecici-vergi-beyannamelerine-iliskin-onemli-duyuru/)).
- **Dijital Vergi Dairesi:** VUK 552 ile İVD, İnternet Vergi Dairesi ve e-Beyanname siteleri dijital.gib.gov.tr'de birleşti ([Andersen](https://tr.andersen.com/tr/images/pdf/and52%20dijital%20vergi%20dairesi.pdf)).
- **İndirilecek KDV listesi:** 06/2024 döneminden itibaren yeni Excel formatı; tevkifata ilişkin 3 yeni sütun var ([alomaliye](https://www.alomaliye.com/2024/07/02/indirilecek-kdv-listesinde-yapilan-degisiklikler-dijital-vergi-dairesi-duyurusu/amp/)). İade listelerinin geçmişi için [KPMG](https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/kdv-iadesi-talebine-ait-listelere-iliskin-yeni-duzenlemeler-getirildi/404).
- **KURGAN:** Riskli faturalar 01.10.2025'ten beri e-tebliğ ile bildiriliyor; mükellef faturayı kayıttan çıkarıp çıkarmayacağına karar vermek zorunda ([alomaliye yorumu](https://www.alomaliye.com/2025/10/03/kurulus-gozetimli-analiz-sistemi-kurgan-nin-vergilendirme-etkileri-maliyet-ve-karlilik/amp/)). Bu bir YMM'nin yorum yazısı, resmi rehber değil. İsteğe bağlı tam tevkifat da bir korunma yolu olarak anılıyor ([Ekonomi Gazetesi](https://www.ekonomigazetesi.com/kose-yazisi/sahte-belgeye-karsi-kalkan-istege-bagli-tam-tevkifat-61425)).
- **e-Defter:** Süre uzatmaları sık oluyor; örneğin 10 ve 15 Haziran 2026 süreleri 30.06.2026'ya uzatıldı ([alomaliye](https://www.alomaliye.com/2026/06/08/e-defter-ve-berat-dosyalarinin-yukleme-suresi-uzatildi/)).
- **Kur değerleme:** TCMB döviz alış kuru (efektif için efektif alış) kullanılır. Değerleme geçici vergi dönem sonlarında da yapılır; kayıtlar 646/656 ([kaynak](https://musavirlerkulubu.com.tr/makale/dovizli-islemlerin-muhasebe-kayitlari-ve-kur-farklari-2026-rehberi)).
- **Z raporu:** Her cihaz için ayrı ve günlük kayıt gerekir; ay sonunda tek fişle toplu kayıt mevzuata uygun değil ([muhasebenews](https://www.muhasebenews.com/?p=161465)). Yazı 2021 tarihli bir özelgeye dayanıyor.

---

## 5. Modül önerileri

### 1) Mizan Sağlık ve Kapanış Kontrolü (Denetim ve Analiz çekirdeği)
- **Ne yapar:** Tüm firmalarda dönem mizanını tarar. Bakılacaklar:
  - Ters bakiyeler; eksi kasa veya yüksek kasa bakiyesi.
  - 191/391'in kapanmaması, 360 ile muhtasar uyumu.
  - Ortak/personel cari hesaplarında yüksek bakiye, 689/KKEG adayları, kapanmamış 7/A–6 yansıtmaları.
  - Sonuç firma bazında kırmızı/sarı/yeşil rapor.
- **Kazanç ve risk:** e-Defter yüklemeden ve beyandan önce hatayı yakalar. e-Defter düzeltmesi zahmetli olduğu için en çok burada zaman kazanılır.
- **Luca verisi:** `mizan_listesi.jq` ve muavin, **yalnız okuma**. Uygulanabilirlik: **kolay**. Risk: düşük.
- **Sinerji:** Mizan ve muavin zaten iniyor; çok firmalı altyapı hazır. Planladığınız Denetim modülünün temeli olur.
- **Kaynak:** [Luca Denetim broşürü](https://www.turmobeimza.com.tr/upload/docs/genel_brosur_luca.pdf). Kural listesi için ayrıca bir kaynak bulmadım; mesleki pratiğe göre derlenmesi gerekir.

### 2) Beyanname ve Muavin Tutarlılık Kontrolü
- **Ne yapar:** Luca'da hazırlanmış veya verilmiş beyanname rakamlarını muavinle karşılaştırır:
  - KDV1 matrah ve hesaplanan KDV ile 600–602 ve 391.
  - İndirilecek KDV ile 191; devreden KDV ile önceki dönem.
  - Muhtasar stopajı ile 360; geçici vergi matrahı ile mizan kârı.
- **Kazanç ve risk:** Pişmanlık, düzeltme beyannamesi ve vergi ziyaı cezası riskini azaltır.
- **Luca verisi:** Luca beyanname ekranları ve muavin, okuma. Beyanname ekranlarının uç noktaları doğrulanmadı; keşif gerekir. Uygulanabilirlik: **orta**. Risk: düşük.
- **Sinerji:** KDV/KDV2 taslağı zaten üretiliyor; bu modül onun "Luca'daki beyan ile karşılaştır" adımı olur.
- **Kaynak:** [e-Beyan duyurusu](https://www.alomaliye.com/2026/06/18/kdv-beyannamelerine-iliskin-onemli-duyuru-4/).

### 3) e-Fatura → Luca Otomatik Fiş (alış ve satış muhasebeleştirme)
- **Ne yapar:** İndirilen e-Fatura, e-Arşiv ve e-SMM belgelerinden, muavinde henüz olmayanlar için kurala ve öğrenmeye dayalı hesap eşleştirmesiyle mahsup fişi önerir. Örnek kurallar:
  - Tedarikçi VKN'sinden 320.xxx alt hesabı.
  - Kalem açıklamasından 153, 770 veya 740.
  - KDV oranına göre 191.xx; tevkifatta 360 veya 391 ayrımı.
  - Ardından `fis_kes.jq` ile Luca'ya yazar.
- **Kazanç ve risk:** Aylık en büyük manuel veri girişini ortadan kaldırır. Unutulan fatura, yanlış KDV oranı ve tevkifat hatalarını azaltır.
- **Luca verisi:** e-Belge ekranları ve muavin okuma, fiş **yazma**. Uygulanabilirlik: **orta**. Risk: yanlış fiş yazılması; kullanıcı onayı ve toplu geri alma şart.
- **Sinerji:** Çok yüksek. Fatura–Muavin modülü "muavinde olmayan faturaları" zaten buluyor. Ekstre modülünün kural motoru ve fiş kesme altyapısı yeniden kullanılır.
- **Kaynak:** Benzerleri [MüşavirPro+](https://www.uyumsoft.com/musavir-pro-mali-musavir-yazilimi), [Faturaport](https://www.faturaport.com/mali-musavir-modulu), [Logo Mali Müşavir](https://www.logo.com.tr/en/urun/logo-mali-musavir-3).
- **Not:** Luca'nın kendi e-Belge muhasebeleştirme özelliği varsa çakışma olabilir. Önce Luca'daki mevcut özellik kontrol edilmeli.

### 4) KURGAN ve Sahte Belge Ön Kontrolü (Tedarikçi Risk Panosu)
- **Ne yapar:** Alış faturalarındaki tedarikçileri risk göstergelerine göre puanlar:
  - İlk kez görülen tedarikçi, kısa sürede yüksek tutar, yuvarlak tutarlar.
  - Ödemenin bankadan yapılmamış olması (Ekstre verisiyle eşleştirme); faturası olup ödemesi görünmeyen alış.
  - GİB'in mükellef ve VKN sorgusu (sorgu yöntemi doğrulanmadı).
  - Sonuçta faturayı kayıttan çıkarma veya tutma kararı için bir dosya hazırlar.
- **Kazanç ve risk:** Sahte belge kullanma iddiası, KDV indirimi reddi ve vergi ziyaı cezası riskini azaltır. KURGAN 01.10.2025'ten beri aktif, konu güncel.
- **Luca verisi:** e-Belge, muavin 320/102 ve ekstre, okuma. Uygulanabilirlik: **orta**. Risk: düşük; puanlama tavsiye niteliğinde olmalı.
- **Sinerji:** Fatura modülü ile Ekstre modülünün birleşimi. Rakiplerde "sahte belge sorgulama" var ([Hattat](https://hattatmusavir.com/)) ama ödeme izi ile eşleştirme görmedim.
- **Kaynaklar:** [KURGAN yorumu](https://www.alomaliye.com/2025/10/03/kurulus-gozetimli-analiz-sistemi-kurgan-nin-vergilendirme-etkileri-maliyet-ve-karlilik/amp/), [isteğe bağlı tam tevkifat](https://www.ekonomigazetesi.com/kose-yazisi/sahte-belgeye-karsi-kalkan-istege-bagli-tam-tevkifat-61425).

### 5) ÖKC / Z Raporu Fiş Girişi (planlanan)
- **Ne yapar:** Z raporlarını (Excel, fotoğraf veya OCR, ya da GİB ÖKC satış verisi) okuyup **cihaz bazında ve günlük** satış fişi keser: 100/108 ile 600 ve 391, KDV oranlarına göre ayrılmış. POS (kredi kartı) tahsilatıyla da karşılaştırır.
- **Kazanç ve risk:** Perakende mükelleflerde en yorucu girişlerden biri. Mevzuata aykırı "ay sonunda tek fiş" pratiğini ortadan kaldırır.
- **Luca verisi:** `fis_kes.jq` ile **yazma**. Uygulanabilirlik: **kolay–orta**. GİB'den ÖKC verisi çekmek doğrulanmadı ve zor olabilir.
- **Sinerji:** Ekstre modülünün okuma ve fiş kesme hattı; kredi kartı ekstreleriyle POS mutabakatı.
- **Kaynaklar:** [Z raporu kayıt kuralları](https://www.muhasebenews.com/?p=161465); Luca Net'teki yazar kasa şikayeti ([Şikayetvar](https://www.sikayetvar.com/luca-muhasebe-sistemi/luca-programi)).

### 6) Dönem Sonu Kur Değerleme
- **Ne yapar:** Dövizli hesaplardaki (102, 120, 320, 300 vb.) döviz bakiyelerini bulur, TCMB kurlarını otomatik çeker (TCMB'nin herkese açık kur XML'i) ve 646/656 değerleme fişini hazırlayıp yazar. Çeyrek dönem sonlarında ve yıl sonunda çalışır.
- **Kazanç ve risk:** Unutulan veya yanlış kurla yapılan değerlemeden doğan geçici vergi matrah hatasını önler.
- **Luca verisi:** Muavinde döviz tutarı kolonu okunur (Luca'nın döviz kolonunu döndürüp döndürmediği doğrulanmadı), fiş yazılır. Uygulanabilirlik: **kolay–orta**. Risk: düşük.
- **Sinerji:** Muavin altyapısı ve fiş kesme hazır.
- **Kaynak:** [Kur farkı rehberi](https://musavirlerkulubu.com.tr/makale/dovizli-islemlerin-muhasebe-kayitlari-ve-kur-farklari-2026-rehberi).

### 7) Banka Bakiye Mutabakatı ve Mükerrer Kayıt Tespiti
- **Ne yapar:** Ekstre kapanış bakiyesini 102.xx muavin bakiyesiyle gün gün karşılaştırır. Kaydı eksik veya iki kez girilmiş hareketleri ve aynı faturanın iki kez kaydını (aynı belge no, VKN ve tutar) bulur.
- **Kazanç ve risk:** Şikayetlerdeki "ekstrenin bir kısmı aktarıldı" ve "mükerrer kayıt" sorunlarına doğrudan cevap verir.
- **Luca verisi:** Muavin okuma. Uygulanabilirlik: **kolay**. Risk: düşük.
- **Sinerji:** Ekstre modülünün doğal devamı.
- **Kaynak:** [Şikayetvar](https://www.sikayetvar.com/luca-muhasebe-sistemi).

### 8) KDV İade Listeleri Hazırlayıcı
- **Ne yapar:** İndirilecek KDV listesi (06/2024 sonrası formatta, tevkifat sütunlarıyla), Yüklenilen KDV listesi ve satış faturaları listesi Excel'lerini e-Belge ve muavin verisinden otomatik üretir.
- **Kazanç ve risk:** İade dosyası hazırlamak çok uzun sürer. Liste hataları iadeyi geciktirir veya eksik belgeye yol açar.
- **Luca verisi:** e-Belge ve muavin 191, okuma; çıktı Excel. Uygulanabilirlik: **orta**. Liste formatları değişebiliyor; GİB'in güncel örnek Excel'i takip edilmeli.
- **Sinerji:** Fatura ile 191 eşleşmesi zaten yapılıyor.
- **Kaynaklar:** [İndirilecek KDV listesi değişikliği](https://www.alomaliye.com/2024/07/02/indirilecek-kdv-listesinde-yapilan-degisiklikler-dijital-vergi-dairesi-duyurusu/amp/), [KPMG](https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/kdv-iadesi-talebine-ait-listelere-iliskin-yeni-duzenlemeler-getirildi/404).

### 9) e-Defter ve Berat Takip Panosu
- **Ne yapar:** Firma ve dönem bazında e-Defter durumunu gösterir (oluşturuldu, imzalandı, berat yüklendi). Son tarihe kalan süreyi ve uzatma duyurularını işler. Yüklemeden önce Modül 1'deki kontrolleri zorunlu tutar.
- **Kazanç ve risk:** Süre kaçırmaya karşı özel usulsüzlük riskini azaltır. Berat gönderim sorunları şikayetlerde öne çıkıyor.
- **Luca verisi:** Luca e-Defter ekranı, okuma. Uç noktalar doğrulanmadı. Uygulanabilirlik: **orta**. Gönderimi otomatikleştirmek **önerilmez**, çünkü imza ve e-imza gerekiyor.
- **Sinerji:** Çok firmalı toplu çalışma altyapısı.
- **Kaynaklar:** [Süre uzatımı](https://www.alomaliye.com/2026/06/08/e-defter-ve-berat-dosyalarinin-yukleme-suresi-uzatildi/); rakipte "eksik berat listesi" ([Hattat](https://hattatmusavir.com/)).

### 10) Cari Mutabakat ve Yaşlandırma (Ba-Bs yerine)
- **Ne yapar:** 120 ve 320 muavininden karşı firma bazında bakiye ve yaşlandırma çıkarır, mutabakat mektubu (PDF veya e-posta) üretir. e-Faturada görünen ama muavinde olmayan cari hareketleri işaretler.
- **Kazanç ve risk:** Ba-Bs kalktıktan sonra karşı taraf uyumsuzlukları erken görülemiyor; bu boşluğu kapatır. Luca Net'in Ba-Bs mutabakatı özelliğinin muadili.
- **Luca verisi:** Muavin okuma. Uygulanabilirlik: **kolay**. Risk: düşük.
- **Sinerji:** Muavin ve e-Fatura verisi hazır.
- **Kaynak:** [Ba-Bs kaldırılması](https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/form-ba-ve-form-bs-uygulamasina-son-verilmesine-iliskin-vuk-tebligi-yayimlandi/2746).

### 11) Bordro, Muhasebe ve Muhtasar Tutarlılığı
- **Ne yapar:** Luca bordro ve personel entegrasyonu fişleri ile 335, 360 ve 361 muavinini, muhtasar ve prim hizmet beyannamesi tutarlarıyla karşılaştırır. Teşvik kontrolü opsiyonel.
- **Kazanç ve risk:** SGK idari para cezası ve hatalı teşvik geri ödemesi riskini azaltır.
- **Luca verisi:** Bordro ekranları ve muavin, okuma. Uygulanabilirlik: **orta–zor**; Luca bordro ekranları doğrulanmadı. Teşvik tarafında Luca Rota ve Hattat zaten var.
- **Sinerji:** Muavin.
- **Kaynaklar:** [Luca Rota](https://www.turmobeimza.com.tr/upload/docs/genel_brosur_luca.pdf), [SGK teşvikleri 2026](https://www.alomaliye.com/2026/09/01/sgk-tesvikleri-2026/amp/).

### 12) Amortisman ve Sabit Kıymet Kontrolü
- **Ne yapar:** Luca sabit kıymet kartlarındaki amortisman ile 257/268 mizanını karşılaştırır. Dönem amortisman fişinin kesilip kesilmediğini ve binek oto gider kısıtlaması adaylarını kontrol eder.
- **Kazanç ve risk:** Geçici vergide eksik veya fazla gider hatasını önler.
- **Luca verisi:** Okuma. Uygulanabilirlik: **orta**. Luca amortismanı zaten hesaplıyor; bu yalnız kontrol katmanı. Öncelik düşük.
- **Kaynak:** [Luca amortisman eğitim başlıkları](https://www.muhasebenews.com/category/luca/).

### 13) Aylık Mükellef Raporu (müşteriye giden PDF)
- **Ne yapar:** Mizandan gelir-gider, kârlılık, KDV yükü, tahmini geçici vergi ve dikkat edilecek noktalar için tek sayfalık rapor üretir; e-posta veya WhatsApp için hazırlar.
- **Kazanç ve risk:** Müşteri iletişimine harcanan zamanı azaltır; ofise katma değer sağlar. Rakiplerde de var (MüşavirPro'da tahakkuk gönderimi).
- **Luca verisi:** Okuma. Uygulanabilirlik: **kolay**.

### 14) e-Beyan Geçiş Asistanı (kontrol amaçlı, gönderim yapmaz)
- **Ne yapar:** Antalya gibi e-Beyan'a geçmiş illerde MuhaWin'in KDV1/KDV2 taslağını e-Beyan alanlarına eşler, Luca'nın oluşturduğu beyanla farkları gösterir.
- **Not:** Doğrudan web servis entegrasyonu GİB'e resmi başvuruyla mümkün. Şimdilik yalnız kontrol önerilir. Uygulanabilirlik: **orta**.
- **Kaynak:** [e-Beyan duyurusu](https://www.alomaliye.com/2026/06/18/kdv-beyannamelerine-iliskin-onemli-duyuru-4/).

**Düşük öncelikli veya önerilmeyenler:**
- Enflasyon düzeltmesi: 2025-2027 için ertelendi.
- Ba-Bs: kaldırıldı.
- Beyanname, tahakkuk ve e-tebligat takibi: pazar kalabalık, İSMMMO aracı ücretsiz, GİB tarafında otomasyon riski var.

---

## 6. İlk yapılması önerilen 4 modül

1. **Mizan Sağlık, Kapanış ve Beyan Tutarlılık Kontrolü (Modül 1 ile 2'nin çekirdeği)**
   - Tamamen okuma odaklı, dolayısıyla en düşük risk.
   - Veri zaten iniyor; en hızlı teslim edilir.
   - Planlanan "Denetim ve Analiz" modülünü başlatır; her ay her firmada kullanılır.
2. **e-Fatura → Luca Otomatik Fiş (Modül 3)**
   - En büyük zaman kazancı burada.
   - Fatura–Muavin modülünün "eksik kayıt" çıktısı ile Ekstre modülünün kural motoru ve `fis_kes.jq` birleşince geliştirme maliyeti düşük kalır.
   - Önizleme, onay ve toplu geri alma ile risk yönetilebilir.
3. **ÖKC / Z Raporu Fiş Girişi (Modül 5)**
   - Zaten planda; perakende mükelleflerde aylık yoğun manuel iş.
   - Mevzuat cihaz bazında günlük kayıt istiyor; Luca tarafında eksiklik şikayeti var.
   - Ekstre hattıyla neredeyse aynı mimari.
4. **KURGAN Tedarikçi Risk ve Ödeme İzi Kontrolü (Modül 4)**
   - 2025 sonundan beri gündemde; ceza riski yüksek.
   - Fatura ve Ekstre verisini birleştiren, rakiplerde görmediğim bir özellik.
   - Okuma odaklı ve düşük risk.

Hemen ardından: Kur Değerleme (çeyrek dönemlerde, kolay) ve Banka Mutabakatı/Mükerrer Kayıt (kolay).

## 7. Yasal ve kullanım koşulu riskleri

- **Luca kullanım koşulları:** Luca'ya özel bir kullanıcı veya lisans sözleşmesine kamuya açık kaynakta ulaşamadım (**doğrulanamadı**).
  - TÜRMOB'un mobil ve web uygulamaları sözleşmesi ([kaynak](https://turmob.org.tr/kullanicisozlesmesi)) "uygulamalara ara yüz ve talimatların dışında bir yöntemle erişmeye çalışmak" ifadesini kötüye kullanım sayıyor.
  - Bu sözleşme Luca'yı açıkça kapsamıyor gibi görünüyor, ama benzer bir yorum riski var.
  - Öneriler:
    - Yalnız kullanıcının kendi oturumunu kullanın; şifre saklamayın, gerekiyorsa Windows DPAPI ile şifreleyin.
    - İstek hızını sınırlayın; Luca'yı yavaşlatacak toplu yük oluşturmayın.
    - Fiş yazan modüllerde açık kullanıcı onayı alın ve log tutun.
    - Orta vadede TÜRMOB/LUCA'dan resmi entegrasyon veya API talep edin (Koza'nın REST API'si var).
- **GİB:**
  - e-Beyan'a muhasebe programı entegrasyonu resmi web servisle ve GİB'e başvuruyla yapılıyor.
  - Dijital Vergi Dairesi'nin bot veya otomasyon kısıtları hakkında açık bir düzenleme bulamadım (**doğrulanamadı**).
  - Beyanname göndermeyi ve e-imza gerektiren işleri (e-Defter berat imzası) otomatikleştirmemenizi öneririm.
- **KVKK:**
  - Mali müşavir, mükellef ve çalışan verisi için veri sorumlusu konumunda. MuhaWin yerel çalıştığı sürece risk düşük.
  - Veriyi bulut veya yurt dışı bir yapay zeka servisine gönderen herhangi bir özellik KVKK 9. madde (2024 değişikliği) kapsamında yurt dışı aktarım sayılır. Bu durumda standart sözleşme ve KVKK'ya bildirim gerekir ([KVKK duyurusu](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu), [Erdem & Erdem](https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verilerin-korunmasi-kanununda-neler-degisti)).
  - VERBİS kayıt eşikleri için [muhasebetr](https://www.muhasebetr.com/yazarlarimiz/erkankipik/055/).
  - Mesleki sır saklama yükümlülüğünü (3568 sayılı Kanun) araştırmadım.
- **Mesleki sorumluluk:** KURGAN puanlaması ve otomatik fişler karar destek aracı olarak sunulmalı; son karar mali müşavirde kalmalı.

## 8. Tüm kaynaklar

**Luca ürünleri**
- https://www.turmobeimza.com.tr/upload/docs/genel_brosur_luca.pdf
- https://luca.com.tr/Upload/UPm0BmiK/1GV9/dDib7ENdcMtELgc.pdf
- https://luca.com.tr/Upload/TDC06tVS/y9P3/7OSi5gP6TbixpjI.pdf
- https://www.muhasebenews.com/category/luca/
- https://www.kuveytturk.com.tr/en/business/cash-management/e-services-and-accounting-management/turmob-luca-bank-account-activity-integration
- https://www.turmob.org.tr/haberler/83cb1f6e-3473-48ee-b441-e7f9d93eeaf9/dijital-vergi-dairesi--e-beyan-ve-e-donusum-gundemi-webinari---29-haziran-2026

**Şikayetler**
- https://www.sikayetvar.com/luca-muhasebe-sistemi
- https://www.sikayetvar.com/luca-muhasebe-sistemi/luca-programi

**Rakipler**
- https://hattatmusavir.com/
- https://www.uyumsoft.com/musavir-pro-mali-musavir-yazilimi
- https://uyumsoft.com/haber/mali-musavirler-ekosmmm-ile-dijitallesiyor
- https://www.faturaport.com/mali-musavir-modulu
- https://facit.app/mukellef-takip-programlari-mukellef-takibi/
- https://www.kolaybi.com/en/bilink
- https://www.ucretsizprogram.org/ucretsiz-e-beyanname-tahakkuk-ve-beyan-indirme-programi/
- https://www.logo.com.tr/en/urun/logo-mali-musavir-3

**Mevzuat**
- https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/form-ba-ve-form-bs-uygulamasina-son-verilmesine-iliskin-vuk-tebligi-yayimlandi/2746
- https://www.alomaliye.com/2024/09/25/vergi-usul-kanunu-genel-tebligi-sira-no-565/
- https://faturaport.com/blog/e-donusum/babs-formu-nedir-2026-guncel-durum-rehberi
- https://www.ey.com/tr_tr/insights/tax/2026-vergi-duzenlemeleri
- https://www.alomaliye.com/2026/06/18/kdv-beyannamelerine-iliskin-onemli-duyuru-4/
- https://tr.andersen.com/tr/images/pdf/and_57-kdv-beyaninin-digital-vergi-dairesinden-verilmesi-uygulamasi-genisledi.pdf
- https://www.alomaliye.com/2026/09/01/gelir-ve-kurum-gecici-vergi-beyannamelerine-iliskin-onemli-duyuru/
- https://tr.andersen.com/tr/images/pdf/and52%20dijital%20vergi%20dairesi.pdf
- https://www.alomaliye.com/2024/07/02/indirilecek-kdv-listesinde-yapilan-degisiklikler-dijital-vergi-dairesi-duyurusu/amp/
- https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/kdv-iadesi-talebine-ait-listelere-iliskin-yeni-duzenlemeler-getirildi/404
- https://www.alomaliye.com/2026/06/08/e-defter-ve-berat-dosyalarinin-yukleme-suresi-uzatildi/
- https://www.alomaliye.com/2025/10/03/kurulus-gozetimli-analiz-sistemi-kurgan-nin-vergilendirme-etkileri-maliyet-ve-karlilik/amp/
- https://www.ekonomigazetesi.com/kose-yazisi/sahte-belgeye-karsi-kalkan-istege-bagli-tam-tevkifat-61425
- https://musavirlerkulubu.com.tr/makale/dovizli-islemlerin-muhasebe-kayitlari-ve-kur-farklari-2026-rehberi
- https://www.muhasebenews.com/?p=161465
- https://www.alomaliye.com/2026/09/01/sgk-tesvikleri-2026/amp/

**Hukuk ve KVKK**
- https://turmob.org.tr/kullanicisozlesmesi
- https://www.muhasebetr.com/yazarlarimiz/erkankipik/055/
- https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu
- https://www.erdem-erdem.av.tr/bilgi-bankasi/kisisel-verilerin-korunmasi-kanununda-neler-degisti

**Doğrulanamayanlar:**
- "Luca Akıllı Entegrasyon Noktası" ve "Luca Konnektör" ürün adları.
- Luca'nın resmi yardım dokümanları ve Excel fiş şablonu.
- Luca'ya özel kullanım koşulları.
- Luca'nın e-Fatura'dan otomatik muhasebeleştirme yapıp yapmadığı.
- GİB'den ÖKC satış verisi ve VKN risk sorgusunun nasıl çekileceği.
- Luca beyanname, e-Defter ve bordro ekranlarının iç uç noktaları; bunlar canlı oturumda keşif gerektirir.
- Hattat ve facit sayfalarındaki özellikler pazarlama iddiası; bağımsız olarak doğrulanmadı.