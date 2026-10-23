# MuhaWin – Ortak (Supabase) Veri Deposu Tasarımı (taslak, 23.10.2026, taban de8ff1e)

**Amaç:** Bir ofisin tüm çalışanları aynı firmaları, kuralları ve kararları görsün. Bir çalışanın tanımladığı kural, diğer çalışanların bilgisayarına birkaç saniye içinde gelsin.

**Kullanıcı kararları:**
- Kurallar yalnız **aynı ofisin çalışanları** arasında paylaşılır. Ofisler arası ortak havuz yok.
- Tek Supabase hesabı (sizin) kullanılır; hosting gerekmez.
- Faturalar (XML/PDF) ve muavin dosyaları **kullanıcının bilgisayarında** kalır.

## 1. Bugün nerede ne var (envanter)

| Veri | Bugünkü yeri | Merkeze? |
|---|---|---|
| Firmalar (`firms`) | `veri.json` (hesap klasörü, ya da ortak ağ klasörü `EkstreLuca-Veri`) | **Evet** |
| Banka karşı hesap kuralları (`rules`) | `veri.json` | **Evet** |
| Fiş / fatura kuralları (`fkurallar`), ÖKC kuralları (`okckural`) | `veri.json` | **Evet** |
| Hesap planı / mizan (`mizan/<firma>.json`) | ayrı dosyalar | **Evet** (ayrı tablo, büyük) |
| Luca çıktı ayarı (`output`), kayıt bilgisi (`registration`) | `veri.json` | **Evet** |
| Luca'ya aktarılan hareketler (`aktarim`, `fkayit`) | `veri.json` | **Evet**. Mükerrer kayıt koruması ancak ortak olursa iki çalışan arasında çalışır. |
| ÖKC fişleri (`okc`) | `veri.json` | Evet (2. aşama) |
| İşlem günlüğü (`gunluk`) | `veri.json` | Evet (2. aşama) |
| Fatura Kontrol `firma.json` (VKN, Luca no, defter türü) | `FK_VERI/firmalar/<ad>/` | **Evet** |
| Kaydedilmeyecek kararları, kuralları; uygun kararları | `kaydedilmeyecek.json`, `kaydedilmeyecek-kurallari.json`, `uygun-kararlar.json` | **Evet** |
| İşletme fiş ayarları, seçimleri | `isletme_fis_*.json` | Evet (aktarım pasif; 2. aşama) |
| İade talebi cevabı, toplu kontrol özeti (kim, hangi ay) | dönem / toplu klasörleri | Evet (2. aşama) |
| e-Fatura XML/PDF, muavin Excel, `rapor.json`, beyanname çıktıları | dönem klasörleri | **Hayır**: yerelde kalır (rapor yeniden üretilebilir) |
| Luca şifresi, çerezler, oturum, cihaz kimliği, `ayarlar.json` | hesap klasörü | **Hayır**: kesinlikle yerelde |

## 2. Sunucu şeması (Supabase, yeni dosya `sunucu/supabase-ortak-veri.sql`)

**Seçilen model:** belge deposu. Bugünkü `veri.json` yapısını ve `datastore.apply(op)` işlemlerini birebir karşıladığı için kod değişikliği en küçük olur.

```sql
create table public.ofis_veri (
  office_id   uuid not null references public.offices(id) on delete cascade,
  tur         text not null,       -- 'firma','kural','fkural','okckural','cikti','aktarim','fk_firma','fk_haric','fk_haric_kural','fk_uygun', ...
  firma       text not null default '',   -- ortak firma anahtarı (bkz. 4)
  anahtar     text not null,       -- kural id, firma id vb.
  veri        jsonb,               -- silinmişse null
  silindi     boolean not null default false,
  surum       bigint not null default nextval('ofis_veri_surum'),  -- eşitleme imleci
  guncelleyen uuid not null default auth.uid(),
  guncellendi timestamptz not null default now(),
  primary key (office_id, tur, firma, anahtar)
);
create index on public.ofis_veri (office_id, surum);
create table public.ofis_mizan (office_id uuid, firma text, hesaplar jsonb, surum bigint, guncellendi timestamptz, primary key (office_id, firma));
```

- **RLS:** Satırı yalnız `office_id = (select office_id from office_members where user_id = auth.uid())` olan kullanıcılar okur ve yazar.
- **Yazma:** `ofis_veri_yaz(p_tur, p_firma, p_anahtar, p_veri, p_sil)` RPC'si. `surum` değerini artırır; `office_id` istemciden alınmaz, sunucuda bulunur.
- **Okuma:** `ofis_veri_degisenler(p_surum)` RPC'si. Verilen sürümden sonra değişen satırları getirir.
- **Silme:** Satır gerçekten silinmez, `silindi=true` işaretlenir; böylece silme işlemi diğer bilgisayarlara da ulaşır.
- **Ofissiz kullanıcı:** Tek kişilik çalışanlar için ilk girişte otomatik "kişisel ofis" açılır; ofise sonradan katılınca verisi taşınır (birleştirme).
- **Yetki:** Kim neyi silebilir? Karar bekleniyor (bkz. 7).

## 3. Program tarafı

- **Electron:** `datastore.js`'e bir **bulut modu** eklenir.
  - `apply(op)` yerel `veri.json` kopyasına yazar (hızlı, internetsiz de çalışır) ve işlemi bir **gönderim kuyruğuna** koyar (`giden.json`).
  - Bağlantı varken kuyruk sırayla RPC'ye gönderilir.
  - Arka planda `ofis_veri_degisenler` ile değişiklikler çekilir: Supabase Realtime ya da 15–30 sn'de bir yoklama.
  - Gelen değişiklik yerel kopyaya işlenir ve arayüze bugünkü `data-changed` olayı gönderilir. Arayüzde (`renderer`) değişiklik çok az olur.
- **Çakışma:** Kural ve karar düzeyinde son yazan kazanır. Aynı kuralı iki kişi aynı anda değiştirirse son kaydedilen kalır; diğer kurallar etkilenmez.
- **Fatura Kontrol (Python):** Supabase'e doğrudan bağlanmaz; token yalnız Electron'da durur. Electron'daki eşitleyici şu dosyaları izler ve iki yönlü eşitler: `firma.json`, `kaydedilmeyecek*.json`, `uygun-kararlar.json`. Python kodu büyük ölçüde değişmez.
- **Ortak ağ klasörü (`sharedDir`):** Bulut modu açılınca gereksiz kalır. Bir kez merkeze taşınır, sonra ayar kapatılır.

## 4. Kritik nokta: firma kimliği

Bugün firma `id`'si her bilgisayarda rastgele üretiliyor (`uid()`). Aynı firma iki çalışanda farklı id ile kayıtlı olabilir.

- **Ortak anahtar:** `luca:<Luca firma no>`; yoksa `vkn:<VKN>`; yoksa `ad:<büyük harf ad>`.
- Fatura Kontrol klasörleri (firma adı) aynı anahtarla eşlenir.
- **İlk geçişte birleştirme:**
  - Her çalışanın yerel verisi merkeze yüklenir.
  - Aynı anahtarlı firmalar tek firma olur; kuralları birleşir. Aynı kural iki kez varsa (aynı anahtar kelime + yön + hesap) teki tutulur.
  - Çakışmalar ekranda raporlanır.

## 5. Geçiş

1. SQL dosyasını kullanıcı Supabase SQL Editor'da çalıştırır (mevcut supabase-*.sql düzeni gibi).
2. Yeni sürüm ilk açıldığında "Verileriniz ofis deposuna taşınsın mı?" sorusu çıkar.
   - Önce yerel yedek alınır.
   - Yükleme yapılır ve sonuç özeti gösterilir: N firma, M kural, K çakışma.
3. Yerel `veri.json` önbellek olarak kalır. Sunucuya ulaşılamazsa program bugünkü gibi yerelden çalışır.
4. **Geri dönüş:** Ayarlarda "Yalnız bu bilgisayarda" seçeneği kalır (bugünkü `useLocal` gibi).

## 6. Aşamalar ve test

- **A1 (bu çalışma):**
  - SQL + RLS + RPC'ler.
  - `datastore` bulut modu: firmalar, kurallar, fkurallar, okckural, çıktı, aktarım, mizan.
  - Geçiş + birleştirme ekranı.
  - Testler: `test/sahte_sb.js`'e `ofis_veri` uçları; iki sahte bilgisayarın birbirinin kuralını görmesi; internetsiz çalışma; kuyruğun yeniden gönderimi; e2e + birim testleri.
- **A2:** Fatura Kontrol dosyalarının eşitlenmesi (firma, kaydedilmeyecek / uygun kararları ve kuralları).
- **A3:** ÖKC fişleri, günlük, toplu kontrol özeti; Realtime ile anında güncelleme.
- **Derleme yalnız kullanıcı isteyince.**

## 7. Kullanıcıdan karar / iş gereken
1. **Kural silme ve değiştirme yetkisi:** her çalışan mı, yalnız ofis yöneticisi mi?
2. **Supabase planı:** Satıştan önce Pro (ücretsiz plan 1 hafta kullanılmazsa durduruluyor). Bölge: AB → KVKK açısından yurt dışı aktarım; hukukçuya danışılmalı.
3. SQL'i Supabase'te kullanıcı çalıştıracak (Claude'un Supabase erişimi yok ve olmamalı; `service_role` anahtarı programa konmaz).

## 8. Riskler
- Firma eşleme hatası, iki farklı firmayı birleştirebilir. Bu yüzden önce önizleme gösterilir, onayla birleştirilir, yedek alınır.
- `aktarim` (mükerrer koruması) büyüyebilir: firma × ay bazında saklanır, eski aylar arşivlenir.
- Gerçek Supabase'te deneme ancak SQL çalıştırıldıktan sonra yapılabilir. Testler sahte sunucuyla yapılır.
