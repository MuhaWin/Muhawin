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

---

# Güncelleme – Görev 51 (24.10.2026): kullanıcı kararları ve aşamalar

Bu bölüm yukarıdaki taslağın yerini alır; çelişen yerde bu bölüm geçerlidir. Sürüm: **2.9.17** (2.9.16 derlenene kadar main'e girmez).

## A. Kullanıcı kararları
1. **Supabase'de (ofis bazında) tutulanlar:** firmalar ve ofisin tüm kuralları.
   - **Program tarafı:** banka kuralları, Luca'ya kaydet kuralları (`fkurallar`), ÖKC kuralları (`okckural`), kod tanımları (firmanın içinde), Luca çıktı ayarı.
   - **Fatura Kontrol tarafı:** kaydedilmeyecekler ve kuralları, uygun kararları, denetim kontrol kuralları ve kararları, `firma.json`.
   - **Davranış:** Ofise bağlı her kullanıcı, hangi bilgisayardan girerse girsin aynı veriyi görür. Değişiklik ötekilerde birkaç saniyede görünür. İnternet yoksa yerel önbellekle çalışılır; değişiklikler kuyruktan sonra gönderilir.
2. **Silme ve değiştirme** tüm çalışanlara açık (`sunucu/yama-51-ofis-veri.sql`: `ofis_veri_silme = 'herkes'`). Yamayı canlıya Supabase işçisi, kullanıcı onayıyla uygular.
3. **Büro bilgileri** Supabase esaslı.
   - Her girişte sunucudaki kayıt gelir; bir bilgisayarda değişince ötekilere geçer (`tur='buro'`).
   - **Luca giriş bilgileri** yalnız o bilgisayarda kalır.
4. **Veri klasörü (yeni anlam):** Fatura–muavin kontrol verileri, yani indirilen e-faturalar, muavinler, raporlar ve toplu özetler, kullanıcının seçtiği klasörde durur.
   - **Seçenekler:** kendi klasörü (varsayılan: hesap klasörü) ya da büronun ortak klasörü.
   - **Ortak klasörde:** Bütün ofis aynı klasörü okur ve yazar. Bir kişinin sorgulaması ötekilerin "Sonuçlar" ekranında "kim sorguladı / ne zaman" bilgisiyle görünür.
   - **Kurallar ve firmalar** bu klasörde değil, Supabase'dedir.
   - **Eski kullanım:** Eski "firmalar/kurallar ortak klasörde" (`sharedDir`) kullananların verisi Supabase'e taşınır.
5. **Güvenli yenileme:** Yeni sorgulama eski belgeleri silmez.
   - Yeni belgeler geçici klasöre iner; sorgulama tam ve hatasız biterse eskisinin yerine geçer, eski ancak o zaman silinir. Yarıda kalırsa eski veri olduğu gibi kalır.
   - Aynı fatura diskte birden fazla kopya tutmaz.
   - Aynı firma ve dönemi iki kişi aynı anda sorgulayamaz (kilit).
6. **İşlem günlüğü:** Supabase'de ofis bazında tutulur ve silinemez. Varsayılan olarak ofisteki herkes görür.
   - **Kayda geçen işlemler:** fiş silme, Luca'ya kaydetme ve aktarma, rapor ve sorgulama, banka işleme, kural ekleme ve silme.
   - **Ekran:** Ayarlar'da süzgeçli bir "İşlem günlüğü" ekranı.

## B. Sunucu
- **`ofis_veri`** (canlıda var, Görev 07) aynen kullanılır. `sahip` = ofis kimliği (ofissiz kullanıcıda kendi kimliği), satır = (`tur`, `firma`, `anahtar`), `veri` jsonb. Silme `silindi=true` ile yapılır. `surum` eşitleme imlecidir.

| tur | firma | anahtar | veri |
|---|---|---|---|
| `firma` | – | firma id | firma nesnesi (bankalar, kod tanımları `fkKod`, ayarlar dahil; `mizanInfo` hariç) |
| `kural` | firma id | kural id | banka kuralı |
| `fkural` | firma id | kural id | Luca'ya kaydet kuralı |
| `okckural` | firma id | kural id | ÖKC kuralı |
| `cikti` | – | `cikti` | Luca çıktı ayarı |
| `buro` | – | `buro` | büro bilgileri |
| `fk_firma` | FK klasör adı | `firma` | `firma.json` |
| `fk_haric`, `fk_uygun`, `fk_dkarar` | FK klasör adı | kayıt anahtarı | kaydedilmeyecek / uygun / denetim kararı |
| `fk_hkural`, `fk_dkural` | FK klasör adı | kural id | kaydedilmeyecek kuralı / denetim kuralı |

- **`ofis_gunluk`** (yeni, yama-51): `id`, `sahip`, `kullanici`, `eposta`, `zaman`, `tur`, `firma`, `ozet`, `ayrinti` jsonb, `cihaz`.
  - Yalnız ekleme var (`ofis_gunluk_yaz`); güncelleme ve silme yok, RLS ve yetkilerle kapalı.
  - Okuma `ofis_gunluk_liste(süzgeç)` ile; aynı ofisin üyeleri görür (ayar: `ofis_gunluk_gorunum` = `herkes` | `yonetici`).

## C. Program
- **Eşitleyici (`ofisveri.js`, Electron ana süreç):**
  - **Yazma:** `datastore.apply(op)` yerel `veri.json`'a yazar (önbellek; internetsiz çalışır), sonra işlemin ürettiği satırları kalıcı kuyruğa (`giden.json`) koyar. Kuyruk `ofis_veri_yaz` ile gönderilir; başarısız olursa artan aralıkla yeniden denenir.
  - **Okuma:** 5 sn'de bir `ofis_veri_degisenler(imleç)` çağrılır. Gelen satırlar yerel önbelleğe işlenir, arayüze `data-changed` gider.
  - **Çakışma ve kimlik:** Satır düzeyinde son yazan kazanır. Ofis değişince imleç sıfırlanıp tam çekim yapılır.
- **İlk geçiş:** Bu bilgisayardaki veri, ya da eski ortak klasördeki (`sharedDir`) veri, sunucudakiyle birleştirilip yüklenir.
  - Önce yerel yedek alınır.
  - Firmalar Luca firma no, sonra VKN, sonra ad ile eşlenir. Aynı firmanın kuralları birleşir.
- **Fatura Kontrol dosyaları:** Eşitleyici, veri klasöründeki firma dosyalarını kayıt bazında iki yönlü eşitler. Son eşitlenen hâl saklanır; farkla gönderilir, gelen değişiklik dosyaya birleştirilir. Python kodu değişmez.
- **Veri klasörü:** `ayarlar.json › fkVeriDir` (boşsa hesap klasörü). Python'a `FK_VERI` ve `FK_KULLANICI` (e-posta) verilir.
- **Kim sorguladı:** `rapor.json` ve toplu özete `sorgulayan` ve `zaman` yazılır; Sonuçlar ekranında gösterilir.
- **Güvenli yenileme (Python):**
  - Dönem belgeleri `<dönem>/.yeni-<zaman>` klasörüne iner. Başarıda eski klasörle yer değiştirir; eski silinir. Hatada geçici klasör silinir, eski yerinde kalır.
  - Firma-dönem kilidi `<dönem>.kilit` dosyasıdır: sahibi, zamanı ve yaşam sinyali içerir; bayatlarsa (10 dk) devralınır.
- **İşlem günlüğü:** `gunlukYaz` yerelde kalır (günün özeti); ayrıca `ofis_gunluk` kuyruğuna girer. Ayarlar › İşlem günlüğü ekranında kullanıcı, işlem, firma ve tarih süzgeçleri var.

## D. Aşamalar
1. Tasarım (bu bölüm) ve SQL yaması (`yama-51-ofis-veri.sql`).
2. Eşitleyici: firmalar, kurallar, çıktı, büro. Kuyruk, internetsiz çalışma, ilk geçiş. Sahte Supabase ile iki bilgisayar testi.
3. İşlem günlüğü (sunucu, kuyruk, Ayarlar ekranı).
4. Veri klasörü seçimi, kim sorguladı, kilit, güvenli yenileme. Fatura Kontrol dosyalarının eşitlenmesi. pytest ve ortak klasörde iki kullanıcı testi.
5. e2e, rapor-51, taslak PR. Canlıya SQL yamasını Supabase işçisi uygular; program sürümü 2.9.17.

## E. Açık noktalar (kullanıcıya sorulacaksa)
- **Mizan / hesap planı:** Şimdilik her bilgisayarda Luca'dan çekilir; ortaklaştırma sonraya.
- **Mükerrer koruması:** `aktarim` ve `fkayit` kayıtları da ofis ortak olmalı mı? Önerim evet; ilk sürümde eklenebilir.
- **ÖKC belgeleri** (`okc`) ve görüntüleri yerelde kalır.
