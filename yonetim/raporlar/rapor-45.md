# Rapor 45 – Kod tanımlarında / fiş kaydetmede "firma bulunamadı"

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `c6afe38` · **Dal:** `claude/awesome-ritchie-ftviuk`
Derleme yapılmadı. Gerçek Luca'ya istek yapılmadı; sahte Luca ile sınandı.

## Belirti (2.9.14 deneme sürümü)
Aynı firmada iki işlem hata veriyor, kayıt yapılmıyor:
- "Faturaları Luca'ya kaydet" › Kod tanımları › "Luca'dan çek"
- "Luca'ya kaydet" (fiş kesme)

Hata: "Bu firma bağlı olduğunuz Luca hesabında bulunamadı."

Aynı firmada mizan ve muavin çekme çalışıyor (yönetici kullanıcıyla doğruladı).

## Kök neden
- **Ortak yol:** Firma seçen bütün işler `luca.js` › `prepareFis`'ten geçiyor: fiş kesme, kod tablosu, Luca'da fiş açma (Görev 37), muavin indirme, hesap planı, cari arama. Kod tablosu farklı bir eşleştirme kullanmıyordu.
- **Arama:** `prepareFis` firmayı Luca'nın `genel/sirket_donem_listesi.jq` listesinde SIRKET_ID ile arıyor, **listede yoksa hemen** bu hatayı veriyordu.
- **Çalışan yollar listeye bakmıyor:**
  - Mizan çekme (`fetchMizan`) doğrudan `genel/donem.jq?sirket_id=` ile çalışıyor.
  - Toplu Kontrol / muavin (Python) firmayı üst çubuktaki `#SirketCombo` listesinden seçiyor.

  İkisi de bu firmada çalıştığına göre firma Luca hesabında var; yalnız `sirket_donem_listesi.jq` onu döndürmüyor.
- **Neden döndürmüyor:** Gerçek yanıt görülmeden kesin söylenemez. Olasılıklar: listenin sınırlı / sayfalı olması, yalnız belli dönemli (çalışma yılındaki) firmaları vermesi, pasif firma.

  Kesin neden için: Luca İstek Kaydı açıkken sayfa yenilenir; `sirket_donem_listesi.jq` yanıtında firmanın olup olmadığına ve kaç firma döndüğüne bakılır. Düzeltme bu nedenden bağımsız çalışıyor.
- **Yeniden üretim (sahte Luca):** Firma listede yok ama dönemi var → eski kod tam olarak "Bu firma bağlı olduğunuz Luca hesabında bulunamadı." veriyor (`test/luca/firma-listede-yok.js`, eski `luca.js` ile).

## Düzeltme (`luca.js` › `prepareFis`)
1. **Firma bulma:**
   - Firma listede yoksa dönemleri `genel/donem.jq?sirket_id=` ile isteniyor (mizan çekmedeki gibi). Dönemi varsa iş sürüyor.
   - Firma ne listede ne dönemiyle bulunamazsa açık hata veriliyor: Luca firma no, Luca'nın listesindeki firma sayısı, ne yapılacağı.
2. **Seçim doğrulaması (yanlış firmaya fiş kesme riski):** Firma / dönem seçimi aynı istekle yapılıyor (`TopFrameAction.do?SIRKET_ID=&DONEM_ID=`, Görev 29 iş kilidi içinde). Seçimden sonra **Luca'da gerçekten bu firmanın seçili olduğu** denetleniyor:
   - **Önce:** Seçim isteğinin yanıtı (Luca üst çubuğu) firma açılır listesini (`#SirketCombo`) seçili firmayla döndürüyor; seçili değer okunuyor.
   - **Yanıtta liste yoksa:** `__SESSION`'daki SIRKET_ID alanına bakılıyor.
   - **Seçili firma istenen değilse:** "Luca'da firma seçilemedi…" hatası; fiş ya da kod tablosu isteği **gitmiyor**.
   - **Firma Luca'nın listesinde yok ve seçim hiçbir yoldan doğrulanamıyorsa:** İş durduruluyor (yanlış firmaya kayıt olmasın).
   - **Listedeki firmalarda doğrulama okunamazsa:** Eskisi gibi sürüyor.
3. **Firma adı:** Listede olmayan firmanın adı üst çubuktaki listeden alınıyor (fiş kaydı raporunda görünür).
4. **Kod tanımları penceresi (`renderer/app.js`):** "Luca'dan çek" firma kartındaki Luca no'yu, yoksa Fatura Kontrol raporundaki Luca firma no'yu kullanıyor (Fatura Kontrol ekranının başka yerlerinde olduğu gibi). Yıl, raporun dönem yılı.

## Testler
| Test | Sonuç |
|---|---|
| `test/luca/firma-listede-yok.js` (yeni) | **12/12** · eski `luca.js` ile 2. senaryoda kullanıcının hatası çıkıyor |
| `test/luca/*.js` (15 dosya; Görev 29 sayfa yönetimi dahil) | hepsi geçti |
| `xvfb-run -a node test/e2e.js` (main `af817e4` ile birleşik) | **367 geçti, 0 başarısız** |
| `node test/mobil.js` | 45/45 |

`firma-listede-yok.js` (sahte Luca):
1. **Listedeki firma:** Birden çok dönem var, doğru yıl seçiliyor.
2. **Listede olmayan, dönemi olan firma:** Kod tablosu ve fiş hazırlığı çalışıyor; dönem 2025 / 2026 doğru seçiliyor; ad üst çubuktan geliyor.
3. **Hiç bulunamayan firma:** Açık hata (firma no, liste sayısı).
4. **İstenen yıl yok:** Var olan dönemler yazılıyor.
5. **Luca no'su olmayan firma:** ARG hatası.
6. **Firma listesi okunamazsa:** Dönemi varsa iş sürüyor.
7. **Luca seçimi uygulamazsa (başka firma seçili kalırsa):** FIRMA_SECIM hatası, Luca'ya istek gitmiyor.
8. **Üst çubukta liste yoksa:**
   - `__SESSION` ile doğrulanıyor.
   - O da okunamazsa listede olmayan firmada iş duruyor, listedekinde eskisi gibi sürüyor.

e2e: "Luca'dan çek" firmanın Luca no'su ve raporun yılıyla gidiyor. Firma kartında Luca no yoksa rapordaki Luca firma no kullanılıyor.

Firma Luca'da SIRKET_ID ile aranıyor; VKN bu yolda kullanılmıyor. Bu yüzden 9 / 10 haneli VKN farkı bu hatayı etkilemiyor.

## Kullanıcının deneyeceği adımlar (aynı firma)
Yeni deneme derlemesinden sonra.
1. **Kod tablosu:** "Faturaları Luca'ya kaydet" › Kod tanımları › Alış kod tanımları › "Luca'dan çek". Tablo dolmalı.
2. **Fiş kaydetme:** Bir faturayı "Luca'ya kaydet" ile kaydedin. Fiş Luca'da **bu firmada** olmalı; Luca'da firmanın fiş listesinden kontrol edin.
3. **"Luca'da firma seçilemedi" ya da "seçimi doğrulanamadı" görülürse:** Ayarlar › Hata Günlüğü'nü gönderin. Mümkünse Luca İstek Kaydı açıkken üst çubuktan bu firmayı elle seçin ve `TopFrameAction.do` yanıtını gönderin.

## Açık konular
- **Listenin neden firmayı döndürmediği** doğrulanmadı (yukarıdaki İstek Kaydı ile netleşir). Düzeltme buna bağlı değil.
- **Doğrulama varsayımı:** Seçim doğrulaması, Luca'nın üst çubuğunu seçili firmayla `<option … selected>` olarak döndürdüğünü varsayıyor (Python Toplu Kontrol aynı listeyi okuyor). Luca seçimi başka yolla gösteriyorsa `__SESSION`'a bakılıyor. İkisi de okunamazsa listede olmayan firmada iş güvenli tarafta durur; 3. adımdaki bilgiyle düzeltilir.
