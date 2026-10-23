# Rapor 07 – Ofis Ortak Verisi (ofis_veri) Depoya Alma ve Yetki Yaması

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `47cdc97` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
**İsteyen:** Yönetici (23.10.2026), kullanıcının gönderdiği canlı şema dökümüne dayanarak. Canlı Supabase'e SQL uygulanmadı; bu kullanıcının işi.

## İstek durumu
| # | İstek | Durum |
|---|---|---|
| 1 | Canlıdaki `ofis_veri` tablosu ve fonksiyonlarını depoya almak (`sunucu/supabase-ofis-veri.sql`) | Yapıldı (1. bölüm). Fonksiyon gövdeleri CSV'den birebir. Tablo kısıtları dökümde yoktu; `on conflict (sahip, tur, firma, anahtar)` ve sütun tiplerinden çıkarıldı (birincil anahtar). Canlıda tablo zaten olduğu için `create table if not exists` hiçbir şeyi değiştirmez |
| 2 | Yetki sorunlarını rapor-02 ekine yazmak | Yapıldı: rapor-02 "Ek – Canlı şema dökümü" (E1–E5) |
| 3 | Düzeltmeyi aynı dosyada tekrar çalıştırılabilir yama olarak hazırlamak | Yapıldı (2. bölüm) |
| 4 | Politika/GRANT bilgisiyle tamamlamak | **Bekliyor.** Kullanıcıdan sorgu çıktısı istendi |

## Yama (2. bölüm) ne yapar
- **Silme yetkisi (E1):** `silindi=true` yalnız ofis yöneticisine açık. Ofissiz kullanıcı kendi verisini silebilir. `bulut-veri-tasarimi.md` §7.1'deki karar bekliyor; karar "herkes" olursa tek satırla değişir:
  `insert into public.settings(key, value) values ('ofis_veri_silme', '"herkes"') on conflict (key) do update set value = excluded.value;`
  Yama yeniden çalıştırılınca bu ayar korunur.
  - Bir istekte tek bir yetkisiz silme varsa istek bütünüyle geri alınır (yarım yazma olmaz).
- **Sınırlar (E2):**
  - Sahip (ofis) başına 200.000 satır. Mevcut satırı güncellemek sınır dolsa da çalışır.
  - İstek başına toplam 20 MB.
  - Satır başına 3 MB ve 500 satır sınırları zaten vardı.
  - Aynı ofisin eşzamanlı yazmaları `pg_advisory_xact_lock` ile sıraya girer; sınır yarışta aşılmaz.
- **Yetkiler:**
  - `_veri_sahibi`, `_veri_yetkili` ve yeni `_veri_silebilir` istemciye (`public`, `anon`, `authenticated`) kapalı.
  - `ofis_veri_yaz` ve `ofis_veri_degisenler` yalnız `authenticated` rolüne açık.
  - Tablo ve sıra doğrudan erişime kapalı.
- `ofis_veri_degisenler` değişmedi (zaten yalnız kendi ofisinin satırlarını okuyor).

## Commit'ler
`git log` için PR'a bakın (rebase sonrası kimlikler değişebilir):
1. Görev 07: canlıdaki ofis_veri SQL'i depoya alındı ve yetki yaması
2. Görev 07: sunucu testleri için ortak yerel PostgreSQL düzeneği ve ofis_veri testi
3. Görev 07: rapor-02 canlı şema eki ve rapor-07

## Değişen dosyalar
- Yeni: `sunucu/supabase-ofis-veri.sql`
- Yeni: `test/ofis-veri-sunucu.mjs`, `test/sunucu/yerel-pg.mjs` (ortak düzenek)
- `test/whatsapp-sunucu.mjs`: kurulum kodu ortak düzeneğe taşındı (davranış aynı)
- `test/sunucu/supabase-taklit.sql`: `profiles`, `settings` eklendi
- `yonetim/raporlar/rapor-02.md`: ek bölüm
- Uygulama kodu değişmedi

## Testler
| Test | Sonuç |
|---|---|
| `node test/ofis-veri-sunucu.mjs` (yerel PostgreSQL 16) | **26/26.** 1. bölüm (canlı hâl) yüklüyken çalışanın silebildiği gösterildi (açık doğrulandı). Yama iki kez üst üste çalıştırıldı. Silme yetkisi, ayar değişimi ve korunması, ofisler arası ayrım, devre dışı kullanıcı, 20 MB ve 200.000 satır sınırları, yetkiler sınandı |
| `node test/whatsapp-sunucu.mjs` | **25/25** (ortak düzeneğe geçişten sonra) |
| pytest, e2e, mobil | Çalıştırılmadı: uygulama kodu değişmedi |

## Riskler ve açık konular
- **Üzerine yazma:** Çalışan bir satırın `veri`'sini boş ya da bozuk bir değerle değiştirerek fiilen silebilir. Tasarım "son yazan kazanır" diyor. Kalıcı çözüm: güncellemede önceki sürümü saklayan `ofis_veri_gecmis` tablosu (tetikleyici, satır başına son N sürüm) ve yönetim ekranında geri alma. Ayrı görev önerisi (S/M).
- **Tablo kısıtları:** Canlı tablonun gerçek kısıtları (birincil anahtar mı benzersiz indeks mi, varsayılanlar) dökümde yok. Fark olsa bile yama çalışır (`on conflict` için benzersizlik yeterli). Politika/GRANT sorgusu gelince karşılaştırılacak.
- **İstemci yok:** `ofis_veri` programın hiçbir yerinde kullanılmıyor. Canlıdaki SQL büyük olasılıkla `bulut-veri-tasarimi.md` A1 denemesinden kaldı. Yine de RPC'ler açık olduğu için giriş yapmış her kullanıcı çağırabiliyor; yama bu yüzden şimdiden gerekli.
- **Sınır değerleri:** 200.000 satır ve 20 MB öneri değerleri. Kullanım ölçülünce ayara taşınabilir.

## Kullanıcı adımları
1. Supabase → **SQL Editor** → **New query** → `sunucu/supabase-ofis-veri.sql` dosyasının **tamamını** yapıştırın → **Run**. Veri silinmez; tekrar çalıştırılabilir.
2. Silme yetkisi kararınız "her çalışan silebilsin" ise, dosyanın 2. bölümünün başındaki tek satırlık `insert … 'herkes'` komutunu ayrıca çalıştırın. Karar verilmezse yalnız ofis yöneticisi silebilir.
3. Henüz göndermediyseniz politika ve yetki sorgusunun çıktısını gönderin; rapor-02 eki tamamlanacak.

## Devir notu
- `test/sunucu/yerel-pg.mjs` sonraki sunucu testlerinde (`supabase-ofis.sql`, `supabase-moduller.sql` için G-E) kullanılabilir.
- Görev 08 (rapor kaydı ayrımı) sıradaki iş.
