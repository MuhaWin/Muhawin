# Rapor 51 – Ofis ortak verisi (Supabase), işlem günlüğü, ortak FK klasörü

**Oturum:** Menü düzenleyici (`session_01PTJcvhW9nnYrh4fnPgxK4n`) · **Taban:** `main` `ba4610f` · **Dal:** `claude/affectionate-darwin-effcgp` · **Hedef sürüm:** 2.9.17 (taslak PR; 2.9.16 deneme derlemesinden önce birleştirilmez)

- Derleme yapılmadı.
- Gerçek müşteri verisi ve canlı Supabase kullanılmadı. SQL yerel PostgreSQL'de, program sahte Supabase'le (`test/sahte_sb.js`) denendi.
- Tasarım: `yonetim/belgeler/bulut-veri-tasarimi.md` › "Güncelleme – Görev 51" (kararlar, satır türleri, aşamalar, açık noktalar).

## 1. Sunucu: `sunucu/yama-51-ofis-veri.sql` (canlıya uygulanmadı)
- **Silme yetkisi:** `settings.ofis_veri_silme = 'herkes'`. Ofisin bütün çalışanları satır silebilir/değiştirebilir (karar 2).
- **`ofis_gunluk` tablosu:**
  - Yalnız ekleme yapılabilir. Güncelleme/silme tetikleyiciyle engelli; RLS açık, doğrudan erişim kapalı.
  - `ofis_gunluk_yaz`: en çok 200 kayıt / 2 MB. Aynı istemci kaydı ikinci kez gönderilirse yinelenmez.
  - `ofis_gunluk_liste`: süzgeçler kullanıcı, tür, firma, tarih aralığı, metin; sayfalı. `ofis_gunluk_gorunum = 'yonetici'` ise çalışan yalnız kendi kayıtlarını görür.
- **Test:** `test/ofis-gunluk-sunucu.mjs` yerel PostgreSQL'de 20/20.
- **Canlıya uygulama:** Supabase işçisi, kullanıcı onayıyla yapacak. Yama uygulanmadan program çalışır; ofis deposu yoksa yerelde devam eder.

## 2. Ofis deposu eşitleyicisi (`ofisveri.js`, `datastore.js`, `cloud.js`, `main.js`)
- **Ofis deposunda tutulanlar:** firmalar (bankalar, kod tanımları dahil; mizan bilgisi hariç), banka kuralları, Luca'ya kaydet kuralları, ÖKC kuralları, çıktı ayarı, büro bilgileri. Ayrıca Fatura Kontrol'ün firma dosyaları: firma.json, kaydedilmeyecekler ve kuralları, uygun kararları, denetim kararları ve kuralları.
- **Yerel önbellek:** `veri.json` önbellektir. Her işlemden sonra fark kalıcı kuyruğa (`giden.json`) girer. 5 sn'de bir önce gönderilir, sonra değişenler çekilir. Satır düzeyinde son yazan kazanır.
- **İnternetsiz çalışma:** İşlem yerelde kaydedilir. Kuyruk program kapanıp açılsa da korunur; bağlantı gelince gönderilir.
- **İlk geçiş:**
  - Firmalar Luca no > VKN > ad sırasıyla eşlenir; yerel kimlik ofis kimliğine çevrilir, mizan dosyası da taşınır.
  - Sunucudaki esastır. Aynı firmada sunucuda boş olan alanlar (ör. banka hesapları) yereldekinden doldurulur.
- **Eski ortak klasör:** `sharedDir` kullananların verisi yedeklenip bu bilgisayara alınır ve ofis deposuyla birleşir.
- **Büro bilgileri ve Luca girişi:** Büro bilgileri ofis deposundan gelir. Luca giriş bilgileri eşitlenmez, bilgisayarda kalır.
- **FK dosyaları (`fkesitle.js`):**
  - Kayıt bazında eşitlenir. İki kişi aynı dosyaya farklı kural eklerse ikisi de kalır.
  - **Güvenlik:** Silme yalnız dosya duruyorken içinden çıkarılan kayıt için gönderilir. Dosya ya da klasör silinirse, veri klasörü değişirse ya da ağ sürücüsü kopuksa ofisteki kayıtlar silinmez. Klasör değişince ve "verileri sil"den sonra kurallar ofis deposundan yeniden iner.
- **Ayarlar ve Veri ve yedek ekranları:** Ofis deposu durumu (bekleyen değişiklik, son eşitleme) ve "Şimdi eşitle" düğmesi.

## 3. İşlem günlüğü
- **Kaydedilen işlemler:**
  - kural ekleme / değiştirme / silme
  - firma ekleme / silme
  - fiş kaydı silme
  - Luca'ya kaydetme / aktarma
  - banka işleme
  - muavin / rapor / toplu sorgulama
- **FK'den gelen kayıtlar:** Fatura Kontrol (Python) kayıtları `FK_GUNLUK` dosyasına yazar; MuhaWin okuyup ofis günlüğüne gönderir.
- **Kuyruk:** Günlük de kuyrukludur; internetsizken birikir.
- **Ayarlar › "İşlem günlüğü":** Süzgeçler kullanıcı, işlem, firma, tarih ve metin; "Daha fazla" ile sayfalanır.

## 4. FK veri klasörü, kim sorguladı, kilit, güvenli yenileme (`fk/fatura_kontrol/ortak.py`)
- **Veri klasörü seçimi:** Veri ve yedek › Fatura kontrol verileri ekranından kendi klasörü ya da büronun ortak klasörü seçilir.
  - Ortak klasör `<seçilen>/MuhaWin-FaturaKontrol` olur. Seçilirken yazma izni denenir.
  - Kurallar ve firmalar bu klasörde değil, ofis deposundadır.
- **Kim sorguladı:** `rapor.json` ve toplu özete `sorgulayan` yazılır, Sonuçlar ekranında "kim · ne zaman" görünür.
  - Toplu özet iki kişinin yazdığını birleştirir: firma bazında daha yeni sorgulama kazanır, bayat liste başkasınınkini ezmez.
- **Kilit:** Aynı firma-dönemi iki kişi aynı anda sorgulayamaz (`<dönem>.kilit`).
  - İkinci kişi "X (bilgisayar) tarafından sorgulanıyor" hatası alır; dosyadan yüklemede HTTP 409 döner.
  - Kilit 30 sn'de bir tazelenir. 10 dk tazelenmeyen kilit devralınır.
- **Güvenli yenileme:** Yeni sorgulama geçici klasöre iner.
  - Tam ve hatasız biterse eskisinin yerine geçer.
  - Yarıda kalır ya da eksik inerse geçici klasör silinir, eski veri olduğu gibi kalır (`eski_veri_korundu`).
  - Arşivde fatura kopyası çoğalmaz.
- **Denetim kuralı kimliği:** Artık zamana dayalı. İki bilgisayarda aynı kimlik çakışmasın diye.

## 5. Testler
| Test | Sonuç |
|---|---|
| `node test/ofis-veri-esitleme.js` (yeni; iki bilgisayar, internetsiz/kuyruk, sharedDir geçişi, FK dosyaları, silme güvenliği) | 22/22 |
| `node test/ofis-gunluk-sunucu.mjs` (yeni; yerel PostgreSQL) | 20/20 |
| `xvfb-run -a node test/e2e.js` (Görev 51 bloğu: ofis deposu, uzak kural, günlük ekranı, internetsiz kuyruk) | 374 ✓, 0 ✗ |
| `pytest` (fk; yeni `test_ortak.py`: kilit, güvenli yenileme, yarıda kalma, eksik indirme, iki kullanıcı özeti, başkası sorgularken dokunmama) | 222 geçti, 2 atlandı |
| `node test/mobil.js` | 45/45 |
| `test/luca/*.js` | hepsi geçti |
| `node test/guncelleme.js` | 36/36 |

- **CI:** `surum.yml`'ye eşitleme testi adımı eklendi.
- **pytest ortam notu:** Bu ortamda tarayıcılı testler için Playwright sürüm takma adı gerekti; CI'da gerekmez.
- **yz.js:** Bu ortamda `@anthropic-ai/sdk` kurulu olmadığından son bölümde düştü; bu değişiklikle ilgisi yok.

## 6. Açık noktalar
1. **SQL yaması:** `yama-51` canlıya Supabase işçisince, kullanıcı onayıyla uygulanmalı. Uygulanana kadar işlem günlüğü sunucuya gidemez, kuyrukta bekler.
2. **Mükerrer koruması:** `aktarim` ve `fkayit` kayıtlarının da ofis ortak olması önerilir (mükerrer koruması bilgisayarlar arasında). Bu görevde yapılmadı.
3. **Yerelde kalanlar:** Mizan / hesap planı ve ÖKC belgeleri yerelde kalıyor.
