# Rapor 34 – "Faturaları Luca'ya kaydet": fiş açma, tek çekme, silinen fiş kontrolü

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `07b712f` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı. Testlerde müşteri verisi yok, sahte veri kullanıldı.

## Bağlam (mevcut yapı)
- **Fatura satırı:** Ekran (`renderer/app.js` › `FKAYIT`) faturaları Fatura Kontrol'den alıyor (`/api/kayit/adaylar`).
  - `kayitli`: fatura muavinde bulundu ("muavinde var").
  - `logged`: MuhaWin bu faturayı Luca'ya kaydetti. Fiş no, kayıt zamanı ve kayıt raporu MuhaWin verisinde (`fkayit`) tutuluyor.
- **"MuhaWin ile kaydedilen" sekmesi:** `logged` olan faturalar; isteğin "muavin ile kaydedilenler" dediği liste bu. Durum sütunundaki "Luca fiş N" çipi de buradan geliyor.

## Yapılanlar
| # | İstek | Çözüm |
|---|---|---|
| 1 | "Luca fişi"ne tıklayınca fiş açılsın | "Luca fiş N" çipi artık düğme. Basınca fiş bu ekrandaki pencerede **muavinden** (Luca'daki hâliyle) açılıyor. Görünüm Görev 19'daki rapor fiş penceresiyle aynı: tarih, hesap, hesap adı, açıklama, belge no, borç, alacak, toplam, dengesizse uyarı. Fiş muavinde yoksa (kayıttan sonra muavin çekilmemiş ya da fiş silinmiş) ne yapılacağı yazıyor |
| 2 | Tek düğme: "Muavini Luca'dan çek" | Ayrı "Mizanı Luca'dan çek" ve "Muavini Luca'dan çek (tüm yıl)" düğmeleri kaldırıldı. Başlıkta tek **"Muavini Luca'dan çek"** var. Sırayla **mizan → hesap planı → muavin (tüm yıl)** çekiliyor; tek pencerede her adımın durumu (… / ✓ / ✕) görünüyor. Bir adım hata verirse o adım adıyla yazıyor (ör. "Mizan alınamadı: …"), sonraki adımlar yine deneniyor. Bitince liste, öneriler ve kayıt durumları yenileniyor |
| 3 | "Daha önce kaydedilenler" raporu | Başlıkta **"Daha önce kaydedilenler"** düğmesi. Bu firmada programdan Luca'ya kesilen fişlerin listesi: fatura (belge no), fiş tarihi, tutar, Luca fiş no, kayıt tarihi, durum (kayıtlı / Luca'dan silindi / Luca'da bulunamadı). Banka modülündeki gibi **"Luca'dan sildim"** işaretiyle fişin "kaydedildi" işareti kalkıyor, fatura tekrar kayıtsız sayılıyor. Onay soruluyor. Banka modülünde işaret bütün aktarıma uygulanıyor; burada fiş başına |
| 4 | Otomatik silinme kontrolü | Muavin çekildiğinde (ekran her açıldığında ve "Muavini Luca'dan çek"ten sonra) programın kaydettiği fiş muavinde yoksa fiş Luca'dan silinmiş sayılıyor. Fatura "MuhaWin ile kaydedilen"den çıkıp **kayıtsız**a geçiyor. Durumda **"Luca'da bulunamadı (silinmiş) · fiş N"**, raporda "Luca'da bulunamadı (silinmiş)" görünüyor |
| 5 | Testler | Aşağıda |

| 6 | Yerleşim: tek düğme fiş seçeneğinin satırında, açıklama kısa | "Muavini Luca'dan çek" ve "Daha önce kaydedilenler" **Fiş** seçeneğinin hemen solunda. Uzun "Hesaplar / cariler boş geliyor…" kutusu kalktı. Yerine başlık satırında tek satırlık **ⓘ çip** var (ör. "ⓘ 30 faturada hesap boş"); açıklama çipin ipucunda (`title`). "Mizan yok" da aynı satırda çip. Ölçüm aşağıda |
| 7 | Bu ekranın "Kural yap"ı da çoklu şart ve "Hiç kaydetme" | Ayrıntı aşağıda |

### 6. Yerleşim ölçümü (1366×768, aynı sahte veri: 30 fatura, hesaplar boş; `test/olcum-fkk.js`)
| | Üst bölüm | Fatura listesi |
|---|---|---|
| Önce (`rapor-34/once.png`) | 215 px (başlık, firma satırı, 3 satırlık uyarı kutusu, fiş satırı) | **160 px** |
| Sonra (`rapor-34/sonra.png`) | 107 px | **268 px** (+108 px, %68) |

1366 px genişlikte yalnız "Excel'e aktar / Luca'ya kaydet / Kapat" ikinci satıra iniyor. Daha geniş ekranda hepsi tek satır.

### 7. "Kural yap": Görev 21 nereye uygulanmıştı
- **Görev 21'in yeri:** Görev 21 (#48) **Banka / Kredi kartı eşleştirme kurallarına** uygulanmış. Kurallar `S.rules`'ta tutuluyor; ortak yardımcılar `kuralSartlari`, `kuralMetni`, `kuralAtla`, `kuralTutar` (`renderer/app.js` başı). Yan paneldeki "Kural ekle" ve tablodaki "Kural yap" bunları kullanıyor.
- **Bu ekranın kuralları:** "Faturaları Luca'ya kaydet" ekranının kuralları **ayrı bir yapı**: `fkurallar` (firma başına; alan ünvan / VKN / içerik, değer, yön, hesap, cari). Penceresi (`FKAYIT.kuralYap`) tek şartlıydı. Görev 21 buraya uygulanmadığı için kullanıcı 2.9.13'te çoklu şartı görmedi.
- **Bu görevde:** Bu ekranın kural motoru ve penceresi Görev 21 ile aynı mantığa getirildi.
  - Şart 1, "+ Şart ekle" ile Şart 2, 3 … eklenebiliyor. Hepsi VE; şartın içindeki `|` ve `+` aynı `kuralTutar` ile çalışıyor.
  - En altta **Sonuç**: "Kaydet (bu şartlar varsa şu hesapla)" ya da "Hiç kaydetme (faturayı fişe alma, bırak)". "Hiç kaydetme"de hesap alanları gizleniyor.
  - Pencerede "N fatura bu şartlara uyuyor" sayacı var.
- **Veri ve eşleştirme:**
  - Kayıt `{alan, deger, ek: [{alan, deger}], eylem: 'atla', …}`. `ek` ve `eylem` yalnız kullanılınca yazılıyor; eski kurallar aynı biçimde kalıyor ve aynı çalışıyor.
  - Çok şartlı kural daha özel sayılıp önce deneniyor.
- **Listede uygulanan kural görünüyor:**
  - Hesap sütununda "kural" çipinin altında kuralın metni var (ör. `Ünvan içerir “SATICI 1”`).
  - "Hiç kaydetme"de durum sütununda "kaydedilmeyecek (kural)" yazıyor (ipucunda kural). Fatura seçilmiyor, "Kaydedilmeyecek" sekmesinde sayılıyor.
  - Kural silinirse fatura yeniden seçiliyor.
- **Muavin kontrolüne etkisi yok:** "Hiç kaydetme" yalnız bu ekranda fişe almamayı belirliyor; muavin kontrolündeki "kaydedilmeyecek" kararı (Fatura Kontrol › Kullanıcı kararı) değişmiyor. Kalıcı "kaydedilmeyecek" için mevcut "Seçilenleri kaydetme" ya da Fatura Kontrol kuralı kullanılıyor.
- **Paylaşılmayan kısım:** İki ekran aynı ifade motorunu (`kuralTutar`) ve aynı VE / eylem mantığını kullanıyor; şart türleri ekrana özgü. Banka: açıklama. Fatura: ünvan / VKN / içerik.

### Silinen fiş kararı (yanlış alarma karşı dört koşulun hepsi)
1. **Muavin sonra indirilmiş:** Muavin dosyası fiş kaydedildikten **sonra** indirilmiş.
2. **Tarih kapsanıyor:** Fişin tarihi muavinin kapsadığı dönemde. Dönem, Luca dökümündeki **"Tarih Aralığı"**; yoksa muavin satırlarının ilk ve son tarihi. Kapsam dışındaysa karar verilmiyor.
3. **Fatura muavinde değil:** Fatura Kontrol eşleştirmesi faturayı muavinde bulamamış.
4. **Fiş no muavinde değil:** Fiş numarası muavinde yok. Karşılaştırma Görev 20 okuyucusunun okuduğu "Fiş No" sütunuyla; boşluk, sondaki ".0" ve baştaki sıfırlar gözetilmiyor (`000101` = `101`).

İşaret kaydı:
- Faturanın "kaydedildi" işareti kalkıyor (`unlogFKayit`).
- Kayıt raporundaki fişe `silindi: {neden: 'muavin' | 'elle', at}` yazılıyor; geçmiş korunuyor.
- Fatura yeniden kaydedilirse yeni fiş numarası görünüyor.

## Değişen dosyalar
- **`renderer/app.js` › `FKAYIT`:** Fiş açma (`lucaFisAc`), tek çekme (`hepsiniCek`, `muavinCekBekle`), geçmiş raporu ve işaret (`gecmis`, `gecmisSil`), silinen fiş kararı (`silinenBul`, `silinenleriIsle`, `isaretle`), durum çipleri.
- **`renderer/app.js` › `HESAP.planYenile`:** İsteğe bağlı `{hata: true}`: hata yutulmuyor, adım adıyla gösterilebiliyor.
- **`fk/fatura_kontrol/muavin_okuyucu.py`:** "Tarih Aralığı" okunuyor (`bilgi["aralik"]`).
- **`fk/fatura_kontrol/kontrol.py`:** Birden çok muavin dosyasında aralık birleşimi.
- **`fk/fatura_kontrol/kayit_aday.py`:** `adaylar` yanıtına `muavin: {bas, bit, aralik_kaynak, zaman, fisler: [[tarih, fiş no], …]}` eklendi; `fis_no_norm`.
- **`main.js`, `preload.js`, `renderer/index.html`, `style.css`:** Dokunulmadı. Görev 33 ile çakışma yok.

## Testler
| Test | Sonuç |
|---|---|
| `fk/tests/test_kayit_silinen.py` (yeni) + `test_muavin_okuyucu.py` (Tarih Aralığı) | 29/29 |
| e2e'ye eklenen 7. madde adımları | 2. şart (VE) ve sayaç, "Hiç kaydetme"de hesap gizli, fatura seçilmiyor ve "kaydedilmeyecek (kural)", kural listesinde VE ve "hiç kaydetme", kural silinince eski kural ve kullanıcının seçimi geri, eski tek şartlı kural aynı ve metni listede |
| `xvfb-run -a node test/e2e.js` | **311 geçti, 0 başarısız** |
| `node test/mobil.js` · tüm `pytest` · `test/luca/*` | 45/45 · **162 geçti**, 1 atlandı · hepsi geçti |
| `xvfb-run -a node test/olcum-fkk.js` (yeni; yerleşim ölçümü) | önce liste 160 px, sonra 268 px |

e2e'ye eklenen adımlar (5. senaryo, sahte Luca):
- Tek düğme var; ayrı mizan / muavin düğmeleri yok.
- **Silinme kararı:** Kayıttan sonra indirilen ve tarihi kapsayan muavinde fiş yoksa "silinmiş" deniyor. Şu durumlarda denmiyor:
  - Muavin kayıttan önce indirilmiş.
  - Fişin tarihi muavinin kapsamı dışında.
  - Fiş no başka biçimde (`00101.0`) muavinde var.
  - Muavin yok.
  - Fatura muavinde.
- **Fiş açma:** "Luca fiş 101" çipi fiş penceresini açıyor (fiş muavinde yok mesajı). Muavinde olan fiş satırlarıyla açılıyor.
- **Otomatik silinme:** İşaret kalkıyor, rapora not düşülüyor, fatura kayıtsızda "Luca'da bulunamadı (silinmiş)" ile görünüyor.
- **Tekrar kaydetme:** Fiş 102 kesiliyor.
- **Daha önce kaydedilenler:** İki fiş görünüyor (biri silinmiş, biri kayıtlı). "Luca'dan sildim" ile fatura yeniden kayıtsız oluyor; çipte "Luca'dan silindi · fiş 102" görünüyor.
- **Tek düğme, iki koşu:**
  - Mizan ve muavin hata verirken hesap planı alınıyor; hatalar adım adıyla yazıyor.
  - Muavin alınınca liste yeniden yükleniyor.

## Kullanıcıya etkisi
- "Faturaları Luca'ya kaydet" ekranında tek **"Muavini Luca'dan çek"** düğmesi var; mizan ve hesap planı da onunla geliyor.
- Luca'dan silinen bir fiş, muavin çekildikten sonra kendiliğinden fark ediliyor ve fatura tekrar kaydedilebiliyor.

## Riskler
- **Silinme kararı muavine bağlı:** Muavin kayıttan önce indirildiyse ya da fişin tarihini kapsamıyorsa karar verilmiyor. Fiş "Luca fiş N" olarak kalıyor; kullanıcı "Daha önce kaydedilenler"den elle işaretleyebilir.
- **Raporda tutar fişin tutarı:** Ayrı fiş düzeninde fatura tutarına eşit. Gruplu fişte (ay sonu / 10 günlük) belge no'lar birlikte listeleniyor.
- **Eski kayıtlar:** Fiş tarihi yoksa fatura tarihi kullanılıyor. Fiş–fatura bağı yoksa belge no ile kuruluyor.

## Test sırasında düzeltilenler
- **Eski kayıt geçmişi:** Ekran kayıt geçmişini açılışta bir kez okuyordu. Kayıttan sonra eski nesne kaldığı için yeni fişler görünmüyordu. Artık her seferinde depodan güncel okunuyor (`logGuncel`).
- **Kural penceresi:** Her açılışta dinleyici ekleniyordu; ikinci açılışta "+ Şart ekle" iki satır açıyordu. Dinleyiciler her açılışta yeniden oluşan forma bağlandı.
- **e2e zamanlama yarışı (testteki eski yarış):** Kayıttan 4 sn sonra muavin yenilemesi kendiliğinden başlıyor. Test artık düğme yoksa bunu bekliyor.
