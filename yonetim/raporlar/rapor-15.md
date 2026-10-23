# Rapor 15 – Lisans ve Ofis Sıkılaştırma (rapor-02 G-E: O4, O6, O7, D2, D3, D8, E5)

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `846436d` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
Canlı Supabase'e SQL uygulanmadı; adımlar aşağıda (kullanıcı). Derleme yapılmadı.

## İstek durumu
| # | Bulgu | Çözüm | Yer |
|---|---|---|---|
| O4 | Modül denemesi zincirlenebiliyordu (her modül +7 gün, TEK LİSANS'ta hepsine geçiyordu) | Otomatik açılan modül denemesi **hesabın kendi deneme başlangıcından** sayılıyor; modül değiştirmek süreyi uzatmıyor. Yönetimdeki "deneme uzat" (`admin_set_trial`, `module_trials`) eskisi gibi çalışıyor | `yama-15` › `app_status` |
| O6 | Cihaz kimliği, istemcinin ürettiği rastgele `cihaz.json`; dosya kopyalanınca cihaz sınırı aşılıyordu | `cihaz.json` bilgisayara bağlandı: Windows `MachineGuid` (Linux `/etc/machine-id`, yoksa bilgisayar adı) **özeti** dosyada. Başka bilgisayarda özet tutmazsa yeni kimlik üretilir. Eski sürümün dosyası ilk açılışta bu bilgisayarı benimser (kimlik değişmez → mevcut kullanıcı cihaz sınırına takılmaz) | `cloud.js` |
| O7 | Bir ofis lisansı sınırsız kullanıcıya | **Kullanıcı kararı: ofis başına en fazla 10 kullanıcı** (yönetici dahil). Hem davet üretirken hem katılırken denetleniyor. Ayar: `settings.ofis_kullanici_siniri` | `yama-15` › `office_invite`, `office_join` |
| D2 | Kod girişinde deneme sınırı yoktu | Lisans kodu ve davet kodunda **15 dakikada 10 hatalı deneme** (kullanıcı başına). Biçim hataları sayılmaz | `yama-15` › `activate_code`, `office_join` |
| D3 | `office_join` hata mesajı davet edilen e-postayı açıklıyordu | Genel mesaj: "Bu davet kodu başka bir e-posta adresine gönderilmiş…" | `yama-15` › `office_join` |
| D8 | `app_status` metinleri sınırsız | Cihaz kimliği / adı 100, sürüm 30 karakter | `yama-15` › `app_status` |
| E5 | `save_registration` boyutu sınırsız | En fazla 20 KB | `yama-15` › `save_registration` |
| O5 | İmzalı çevrimdışı durum | **Bu görevde yapılmadı (büyük)**. Öneri aşağıda | — |

- **Yama dosyası:** `sunucu/yama-15-lisans.sql`. Fonksiyon gövdeleri **canlı sunucudaki hâllerinden** (23.10.2026 şema dökümü) türetildi; değişen satırlar `Yama 15` yorumuyla işaretli. Tekrar çalıştırılabilir, veri silmez.
- **Yeni nesneler:** `kod_denemeleri` tablosu (RLS açık, doğrudan erişim kapalı); `_kod_deneme_kontrol`, `_kod_deneme_yaz`, `_ofis_siniri` yardımcıları (istemciye kapalı).
- **Değişen fonksiyonlar:** `app_status`, `activate_code`, `office_join`, `office_invite`, `save_registration`. Bunlar `anon`'a kapalı, `authenticated`'a açık.

## O5 önerisi (ayrı görev, M)
Çevrimdışı önbellek (`oturum.bin`) imzasız; düz metne düşme yolu var.
1. Sunucu `app_status` yanıtına süreli bir imza ekler (Ed25519; özel anahtar Supabase'de, yalnız `service_role` erişimli bir edge fonksiyonunda ya da Vault'ta).
2. Program yanıtın imzasını gömülü açık anahtarla doğrular; imzasız ya da süresi geçmiş önbelleği kabul etmez. `dec()`'teki düz metne düşme kalkar.
3. `offline_days` üst sınırı programa gömülür.

Not: Masaüstü istemci yine yamanabilir; bu yalnız çıtayı yükseltir. Sunucu (edge fonksiyonu ya da pgsodium) + `cloud.js` + testler gerekiyor.

## Testler
| Test | Sonuç |
|---|---|
| `node test/lisans-sunucu.mjs` (yerel PostgreSQL 16 + Supabase taklidi + depodaki `moduller` / `ofis` / `yonetim` SQL'leri + yama ×2) | **29/29.** Yama öncesi O4 açığı gösterildi. Yamadan sonra: tek deneme, yönetici uzatması geçerli, uzunluk sınırları, 20 KB, 10 hatalı deneme + 15 dk, kullanıcı başına sınır, D3 mesajı, ofis sınırı (3'e çekilip davet ve katılımda), yetkiler |
| `node test/cihaz.js` | **5/5.** İlk giriş, aynı bilgisayarda sabit kimlik, eski sürüm dosyası benimseniyor, kopyalanan dosyada yeni kimlik, yalnız özet saklanıyor |
| `node test/mobil.js` | **45/45** |
| `xvfb-run -a node test/e2e.js` | **270 geçti, 0 başarısız** (güncel `main` üzerinde). Rebase öncesi bir koşuda Çek/Senet › Logo adımı bir kez kırıldı (0 fiş; mizan yanlış firmadan yüklenmişti). Aynı kod yeniden koşunca geçti: zamanlama yarışı. Testte firma değişimini bekleyen satır (`waitForFunction(... 'savor' ...).catch(() => {})`) zaman aşımını sessizce yutuyor. Sağlamlaştırma önerisi: `.catch` kaldırılıp süre 30 sn yapılsın (ayrı küçük iş) |

## Kullanıcı adımları
1. **SQL:** Supabase → SQL Editor → New query → `sunucu/yama-15-lisans.sql`'in tamamını yapıştırın → Run. Veri silinmez; tekrar çalıştırılabilir.
2. **Ofis kullanıcı sınırı:** Varsayılan 10. Değiştirmek için aynı yerde: `update public.settings set value = '15' where key = 'ofis_kullanici_siniri';`. 10'dan kalabalık mevcut ofisler etkilenmez; yalnız yeni davet ve katılım durur.
3. **Program:** O6 (cihaz kimliği) bir sonraki sürümle gelir. Güncelleme oturumu derlediğinde ek adım yok.
4. **Kontrol (isteğe bağlı):** SQL'den sonra programda lisans kodu ekranına aynı yanlış kodu 11 kez girin; 11.'de "Çok fazla hatalı deneme" çıkmalı.

## Riskler
- **O4, eski kayıtlar:** Yama öncesi zincirlenmiş deneme kayıtları (`module_trials`) silinmedi; süreleri dolana kadar geçerli. İstenirse yönetimden tek tek kısaltılabilir.
- **O6:** Windows'ta `reg` çalışmazsa (kısıtlı ortam) bilgisayar adına düşülür; aynı adlı iki bilgisayar aynı özeti alır (yalnız kopyalanan dosyada fark eder). macOS'ta bilgisayar adı kullanılır.
- **D2:** `kod_denemeleri` 1 günden eski kayıtları her denemede siler; tablo büyümez.
- **O7:** Ofis sınırı yöneticiyi de sayar (10 = yönetici + 9 çalışan).
