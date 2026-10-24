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
| `xvfb-run -a node test/e2e.js` | E2E_34 |
| `node test/mobil.js` · tüm `pytest` · `test/luca/*` | SONUC_34 |

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
