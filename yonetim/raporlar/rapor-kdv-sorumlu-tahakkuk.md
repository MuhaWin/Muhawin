# Rapor – KDV beyannamesi: sorumlu sıfatıyla KDV ödendi mi, önceki ayların tahakkuk fişi

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **İstek:** kullanıcı (doğrudan) · **Taban:** `main` `6db9529` · **Dal:** `claude/awesome-ritchie-ftviuk`
Derleme yapılmadı. Testlerde sahte muavin kullanıldı, müşteri verisi yok.

## İstek
1. **Sorumlu sıfatıyla KDV:** İade sorusu gibi "sorumlu sıfatıyla indirilen KDV ödendi mi?" sorulsun.
   - Ödendiyse işlem aynı kalsın.
   - Ödenmediyse bu KDV indirimden çıkarılsın ve beyanname buna göre hesaplansın.
2. **Önceki ayların tahakkuk fişleri:** Muavindeki fişlerde, beyanname ayından önceki aylar için ("Ocak ayı KDV tahakkuku" gibi) KDV tahakkuk fişi var mı aransın. Olmayan ay için uyarı verilsin ("Temmuz ayına ait KDV tahakkuk fişi bulunamamıştır"), çünkü devreden KDV bu yüzden yanlış gelebilir.

## Yapılanlar
### 1. Sorumlu sıfatıyla KDV ödendi mi?
- **Tutar:** Dönemin KDV2 tahakkuku: 360 altında tevkifat / sorumlu KDV hesabının alacağı. Yoksa 109'a giden 191 satırları ("Sorumlu sıfatıyla…" ya da 191.02).
- **Soru nerede:** Tutar varsa iade sorusunun yanında soruluyor:
  - KDV Beyannamesi ekranının solunda "Sorumlu sıfatıyla KDV" kartı
  - çıktı raporunda (dosya raporu) KDV bölümünün başında
- **Cevaplar:**
  - **Ödendi** ya da cevapsız: Hesap eskisi gibi; cevapsızken ödendi sayılıyor.
  - **Ödenmedi:**
    - tutar "Bu döneme ait indirilecek KDV"den çıkarılıyor; indirimler toplamı, ödenecek ve sonraki döneme devreden buna göre değişiyor
    - "109 – Sorumlu sıfatıyla ödenen KDV" satırı ve Ekler'deki bildirim 0 / gizli
    - indirimler detayında "Sorumlu sıfatıyla beyan edilen KDV – ödenmedi, indirimden çıkarıldı" satırı (eksi) görünüyor
    - notlarda "… ödenmediği için bu dönem indirimden çıkarıldı; ödendiği dönemde indirilebilir"
- **Saklama:** Cevap dönem klasöründe saklanıyor (`sorumlu_odeme.json`, iade cevabı gibi). Excel'e de yansıyor.

### 2. Önceki ayların KDV tahakkuk fişi
- **Taranan aylar:** Beyanname ayından önceki aylar, aynı yılın Ocak'ından. Eylül için Ocak–Ağustos; Ocak beyannamesinde tarama yok.
- **Ay şöyle tanınıyor:**
  - **Fiş adından:** Muavin satırının açıklamasında KDV + TAHAKKUK ve ayın adı ya da "MM/YYYY". Örnekler: "OCAK AYI KDV TAHAKKUKU", "mayıs ayı kdv tahakkuku", "04/2026 KDV TAHAKKUK". Büyük / küçük harf ve Türkçe karakter fark etmiyor. Fiş sonraki ay tarihli olsa da adındaki aya sayılıyor.
  - **Yapısından:** O ay tarihli, 190 geçen ya da 391 borç + 191 alacak içeren fiş (programın zaten kullandığı tahakkuk tanıma).
- **Uyarı:** Bulunamayan ay için ekranda kırmızı kutu: "KDV tahakkuk fişi bulunamadı: Temmuz ayına ait KDV tahakkuk fişi bulunamamıştır. Önceki dönemden devreden KDV bu nedenle yanlış gelebilir; fişleri kontrol edin." O ayda KDV hesabı hareketi de yoksa ayrıca belirtiliyor.
  - Aynı uyarı çıktı raporunda ve beyanname notlarında (Excel) da var.
- **Muavinin kapsamı:**
  - Muavinin kapsamadığı aylar eksik sayılmıyor; "Muavin … ayını kapsamıyor; denetlenemedi (yıllık muavini çekin)" diye ayrıca yazılıyor.
  - Kapsam, muavindeki "Tarih Aralığı"ndan, yoksa ilk hareketten alınıyor.

## Değişen dosyalar
- `fk/fatura_kontrol/cikti.py`:
  - `tahakkuk_ay_kontrolu`
  - `kdv_beyani`'ye `sorumlu` ve `kapsam_bas`
  - `Beyan`'a sorumlu alanları; `bu_donem_indirim` ödenmeyeni düşüyor
  - çıktı raporunda soru ve uyarı
- `fk/fatura_kontrol/beyanname.py`: Cevapların saklanması (`_cevap`). JSON'a `sorumlu` ve `tahakkuk_kontrol` eklendi.
- `fk/fatura_kontrol/web/app.py`: `/api/beyanname` ve `/api/rapor/cikti` artık `sorumlu` parametresini alıyor.
- `fk/fatura_kontrol/web/static/beyanname.html`: soru kartı, tahakkuk uyarısı, indirim detay satırı.
- Testler: `fk/tests/test_cikti.py`, `fk/tests/test_muhawin.py`, `test/e2e.js`.

## Testler
| Test | Sonuç |
|---|---|
| `cd fk && pytest` | 173 geçti, 1 atlandı |
| `node --test web/denetim/kopru.test.mjs` | 5/5 |
| `node --test test/site_uret.test.js` | 6/6 |
| `test/luca/*.js` | 13 dosya geçti |
| `xvfb-run -a node test/e2e.js` | **350 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

**Python testleri:**
- **Sorumlu sıfatıyla KDV:**
  - Ödendi / cevapsız: indirimler aynı (2.134.191,88).
  - Ödenmedi: 22.461,73 çıkarılıyor, sonraki döneme devreden aynı tutarda azalıyor.
  - Raporda soru ve "indirimden çıkarıldı" var; sorumlu KDV olmayan dönemde soru yok.
- **Tahakkuk taraması:**
  - Ocak–Ağustos'ta adından (5 biçim) ve yapısından (Mart) tanınan aylar bulunuyor; Temmuz eksik ve hareketli.
  - Muavin Mart'tan başlıyorsa Ocak / Şubat ayrıca bildiriliyor.
  - Ocak'ta tarama yok.
  - Sonraki ay tarihli "Ağustos ayı KDV tahakkuku" Ağustos'a sayılıyor.
- **API:**
  - Cevap `sorumlu_odeme.json`'a yazılıyor ve sonraki istekte okunuyor.
  - Tüm yılı kapsayan, tahakkuk fişi olmayan muavinde 8 ay uyarısı çıkıyor.

**Ekran testi (e2e):**
- Soru kartı ve tutar görünüyor; ödenmedi satırı geliyor.
- Cevap isteğe `sorumlu=` olarak gidiyor.
- Kırmızı "Temmuz ayına ait KDV tahakkuk fişi bulunamamıştır" uyarısı çıkıyor.

## Kullanıcının deneyeceği adımlar
1. **Soru:** Tevkifatlı alışı olan bir firmanın kontrol edilmiş dönemini KDV Beyannamesi'nde açın. Solda "Sorumlu sıfatıyla KDV" kartı ve tutar görünmeli.
2. **Ödenmedi:** "Ödenmedi – indirimden çıkar" → Uygula. İndirimler toplamı tutar kadar azalmalı. Ödenecek / sonraki döneme devreden buna göre değişmeli, 109 satırı 0 olmalı.
3. **Tahakkuk taraması:** Yıllık muavini çekilmiş bir firmada, KDV tahakkuk fişi kesilmemiş bir ay varsa üstte kırmızı uyarıda o ay yazmalı.

## Açık konular
- **Kısmi ödeme sorulmuyor:** Soru evet / hayır. KDV2'nin bir kısmı ödendiyse tamamı ödenmedi sayılır.
- **Ödendiği dönemde indirim:** Ödenmeyen tutar sonraki dönemde kendiliğinden eklenmiyor; ödendiği ay muavinde indirim kaydı varsa o ay beyannamede görünür.
- **Taranan dönem:** Yalnız aynı yılın önceki ayları taranıyor (Ocak beyannamesinde geçen yılın Aralık'ı yok).
