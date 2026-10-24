# Rapor 37 – Rapordaki "Luca'da aç"

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 24.10.2026
Dal: `claude/beautiful-bohr-c7x9ij` (oturum ortamının dalı). Taban: `main` 616cf74. Derleme yapılmadı.

## Ne yapar
Fatura kontrol raporunda (tek firma ve Toplu › Sonuçlar › Rapor; uygun, uygun değil ve hatalı her satırda) satırın sonunda **"Luca'da aç"** düğmesi var. Basınca:
1. Luca'da firma ve dönem seçilir (fişin yılı).
2. **Luca'da Çalış** penceresinde (yoksa açılır) Fiş Listesi (`YMFrameAction.do?modul=10`) açılır.
3. Süzgeç formu (`listFisParametreForm`) yalnız o fiş numarasıyla gönderilir: `ilkFisNo = sonFisNo = <no>`, tarihler boş, diğer alanlar Luca'nın varsayılanında (`fisDurum=1`, `P_FIS_KODU=Tümü`).
4. Pencere öne gelir; kullanıcı yalnız o fişi görür ve isterse kendisi açar.

**Program fişte ve Luca kayıtlarında hiçbir değişiklik yapmaz.** Formun "Sil" gibi düğmelerine dokunulmaz (testte sınandı).

- **Fiş no biçimi:** Rakamsa en az 4 hane, baştaki sıfırlarla (143 → `0143`; kayıttaki örnek). 5+ haneli ya da harfli numara olduğu gibi gider.
- **Pasif düğme ve açıklaması:**
  - fiş yoksa (fatura muavinde kayıtlı değil): "Luca fişi yok";
  - firmanın Luca kimliği yoksa: "Ayarlar › Firmalar › Luca'dan firma ekle";
  - MuhaWin dışında açılmışsa: "Yalnız MuhaWin programı içinde çalışır".
- **Birden çok fişi olan satır:** Düğme ilk fişi açar. Diğerleri için fiş numarasına tıklanır; Görev 19'daki fiş penceresinde de "Luca'da aç" var.
- **Fiş Listesi'ndeki "Luca'da Aç"** (renderer): önce bu yeni yolu dener. Olmazsa eski davranışa döner: firma / dönem seçilir, numara panoya kopyalanır.

## Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `luca.js` | Yeni `fisGoster()` ve sayfa betiği `FIS_GOSTER_JS`; mevcut işlevler değişmedi. Firma / dönem çözümü `IS.prepareFis` ile (Görev 29 iş kilidi). Gösterim `calismaW`'de. Export: `fisGoster`, `_fisNoBicim` |
| `main.js` | `luca-fis-goster` IPC; girdi doğrulaması: Luca kimliği rakam, yıl `20xx`, fiş no ≤ 20 karakter ve yalnız harf / rakam / `-` `/` |
| `preload.js` | `luca.fisGoster` |
| `renderer/app.js` | FK mesajı `lucaFisAc` → Luca bağlantısı beklenir, meşgul göstergesi, `fisGoster`, bildirim. Fiş Listesi düğmesi yeni yola geçti, eski yol yedek |
| `fk/fatura_kontrol/web/app.py` | `/api/rapor` yanıtına `luca_id` (firma klasöründeki `firma.json`; yalnız okuma) |
| `fk/fatura_kontrol/web/static/index.html` | Kontrol, Faturası bulunamayan, Fatura dışı ve Red / iptal sekmelerine "Luca'da aç" sütunu; fiş penceresine düğme. Mesaj `window.top`'a gider (Toplu içindeki rapor çerçevesinden de çalışır) |

## Karar noktası (yönetici)
`luca.js`'teki kural: "Luca'da Çalış penceresinde program hiçbir istek yapmaz." `fisGoster` bu pencerede yalnız **kullanıcı düğmeye bastığında** ve yalnız **görüntüleme** (firma çubuğu, Fiş Listesi süzgeci) yapıyor. Arka plan işleri (mizan / muavin / fiş aktarma) yine ortak / ek sayfalarda ve iş kilidiyle yürüyor. Kullanıcının fişi kendi penceresinde görmesi istendiği için bu pencere seçildi. Ortak sayfa seçilseydi, kullanıcı oraya tıklarken arka plan işleri bozulabilirdi.

## Testler
- `node test/luca/fis-goster.js`: **20/20**. Çerçeveli taklit Luca sunucusunda sınananlar:
  - firma çubuğu SIRKET_ID / DONEM_ID ile;
  - `modul=10`;
  - süzgeç sayfası üye numarasıyla;
  - POST gövdesi `ilkFisNo=sonFisNo=0143`, tarihler boş, `fisDurum=1`, `P_FIS_KODU=Tümü`;
  - sonuç çalışma alanında; "Sil"e dokunulmuyor;
  - form iç içe çerçevede de, doğrudan süzgeç sayfasında da bulunuyor;
  - çerçeve yoksa açık hata;
  - fiş no biçimi.
- `fk/tests/test_luca_ac.py`: **3/3**.
  - `/api/rapor` `luca_id` döndürüyor; Luca kimliği yoksa boş.
  - Tarayıcıda (Electron kimliğiyle, iç çerçevede): fişli satırda etkin, fişsiz satırda "Luca fişi yok" ile pasif; tıklama üst pencereye `{tip:'lucaFisAc', lucaId:'55', yil:'2026', fisNo}` gönderiyor; fiş penceresindeki düğme de çalışıyor.
  - Düz tarayıcıda bütün düğmeler pasif ("Yalnız MuhaWin").
- `python -m pytest -q fk/tests`: 144 geçti, 16 düştü. `main` 616cf74'te **aynı 16** düşüyor (liste birebir; Chrome / Luca ortam testleri).
- `test/luca/*.js`: 12/12 çıkış 0. `node test/mobil.js` 45/45. Site köprüsü 5/5.
- **e2e (`test/e2e.js`, Electron) bu ortamda çalıştırılamadı:** Electron kurulu değil, indirmesi ağda kapalı. CI'daki `surum.yml` adımında doğrulanmalı.

## Gerçek Luca'da doğrulanmadı
Akış, kullanıcının istek kaydındaki adreslere ve form alanlarına göre yazıldı, ama gerçek Luca'da denenmedi. Riskler:
- `YMFrameAction.do?modul=10` formu farklı bir çerçevede yüklüyorsa: 3 düzeye kadar iç çerçeve aranıyor, bulunamazsa `getFisParametreJSPAction.do` doğrudan açılıyor.
- Luca formu kendi JS'iyle gönderip ek alan istiyorsa: form `HTMLFormElement.submit` ile, olduğu gibi gönderiliyor.
- Fiş no 4 hane biçimi.

Kullanıcının ilk denemesinde bunlar görülür. Sorun olursa fiş numarası bildirimde yazıyor; elle aranabilir. Fiş Listesi düğmesinde yedek yol (panoya kopyalama) var.

## Sonraki değişiklik (24.10.2026, kullanıcı isteği)
Rapor listelerindeki satır sonu **"Luca'da aç" sütunu kaldırıldı**. Bu sütun kontrol, faturası olmayan, fatura dışı ve red / iptal sekmelerindeydi. Kullanıcı fiş numarasına tıklayıp fiş penceresindeki "Luca'da aç" düğmesini kullanıyor; o düğme yerinde duruyor.

Kod tarafında:
- `index.html`'de `lucaBtn`, `ilkFis`, `.lucabtn` stili ve `data-lucafis` dinleyicisi silindi.
- `lucaFisAc` ve `#fisLuca` duruyor.

Test (`fk/tests/test_luca_ac.py`) bunları sınıyor:
- listede düğme yok;
- her sekmede başlık, süzgeç ve satır hücre sayıları aynı;
- fiş penceresindeki düğme `lucaFisAc` mesajını gönderiyor;
- MuhaWin dışında bu düğme görünmüyor.
