# Rapor 19 – Toplu kontrol "Tümü" ve rapordaki fişin ekranda açılması

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 23/24.10.2026 (gece)
Dal: `claude/beautiful-bohr-c7x9ij` (oturum ortamının dalı). Taban: `main` 6c67f88.
`renderer/index.html`'e dokunulmadı.

## Yapılanlar
1. **Toplu kontrol › Sonuçlar › "Tümü"** (`fk/fatura_kontrol/web/static/toplu.html`)
   - Durum kutularının başına **"Tümü (N)"** kutusu geldi. Tıklayınca durum filtresi (Sorun var, Hata …) ve tablonun sütun filtreleri birlikte temizlenir; o ayın bütün sonuçları listelenir.
   - Filtre yokken "Tümü" seçili görünür. Bir durum seçilince ya da sütun filtresine yazılınca seçili görünüm kalkar.
2. **Fiş kontrol raporunda fiş numarasına tıklayınca fiş açılır** (`fk/fatura_kontrol/web/static/index.html`)
   - "Kontrol" ve "Red / iptal" sekmelerinde, "Hesap / fiş" sütunundaki fişler (`10 (05.09.2026)`) düğmeye döndü.
   - "Faturası bulunamayan" ve "Fatura dışı" sekmelerinde "Fiş no" sütunu düğme oldu.
   - Tıklayınca pencerede fişin bütün satırları görünür: **tarih, hesap, hesap adı, açıklama, belge no, borç, alacak** ve toplam (dengesizse uyarı). Pencere Esc ya da "Kapat" ile kapanır.
   - "Yazdır / PDF": tarayıcıda yazdırılabilir fiş açılır; MuhaWin içinde ise Mikro Denetim'deki gibi PDF'e dönüştürülür (`htmlPdf`).
   - Sütun filtresi ve sıralama değişmedi; düğmenin metni aynı kaldığı için filtre yine çalışıyor.
   - Veri: var olan **yalnız okuma** ucu `/api/denetim/fis` (muavinden, rapor klasörü). `app.py`'de yalnız satırlara `tarih` alanı eklendi; yeni uç yok, yazma yok.

## Testler
- Yeni `fk/tests/test_fis_ve_tumu.py`: **2/2**
  - API: rapordaki fişin satırları tarihli; faturası bulunamayan kaydın fişi açılıyor; olmayan fiş 404.
  - Tarayıcı (Chromium, sahte veri): rapor sayfasında fiş düğmesi → pencere (tarih, 191, borç) → Esc; "Faturası bulunamayan" sekmesinden fiş açılıyor. Toplu sonuçlarda durum kutusu → 1 satır; sütun filtresi → 1 satır, "Tümü" seçili değil; "Tümü" → 3 satır, filtreler boş, "Tümü" seçili. Sayfa hatası yok.
  - Chromium yoksa tarayıcı testi atlanır (`PW_CHROMIUM` ile yol verilebilir).
- `python -m pytest -q fk/tests`: 101 geçti, 16 düştü, 1 atlandı.
  - `main` 6c67f88'de aynı komut: 99 geçti, **aynı 16** düştü. Liste birebir karşılaştırıldı; düşenler Chrome kanalı / Luca otomasyonu testleri (ortam, açık konu 5).
- Site: `node --test web/denetim/kopru.test.mjs` 4/4. Denetim'in köprüsü yeni `tarih` alanıyla sorunsuz çalışıyor.
- **e2e (`test/e2e.js`, Electron) bu ortamda çalıştırılamadı:** Electron kurulu değil, indirmesi de GitHub'dan yapılıyor ve oturumun ağında kapalı. CI'da (`surum.yml`) pytest ile birlikte çalışıyor; PR'da oradan doğrulanmalı. Değişiklikler yalnız FK sayfalarında (iframe içeriği); e2e'nin denetlediği MuhaWin kabuğuna dokunulmadı.

## Diğer
- `web/site/surum.json` yeniden üretildi: `main`'deki `OKUBENI.txt`'de "Hızlı Fiş Girişi" → "Belgeden Fiş" (Görev 10) değişmişti.

## Devir notu
- Fiş penceresi rapor kimliğiyle (`veri.id`) çalışır. Muavin dosyası rapor klasöründe yoksa (eski raporlar) "Fiş muavinde bulunamadı" iletisi çıkar.
- Toplu "Tümü", sütun filtrelerini `tema.js`'in tablo durumundan (`window.__tablo.durum`) temizler. `tema.js` filtre yapısı değişirse bu satır güncellenmeli; test yakalar.
