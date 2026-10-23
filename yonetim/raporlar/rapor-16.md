# Rapor 16 – e2e'nin GitHub Actions'ta Düşmesi

**Oturum:** Yazılımcı (`session_01HKMyx49yrftMV598oVTfLH`) · **Taban:** `main` `da56fad` · **Dal:** `claude/awesome-ritchie-ftviuk` (oturum ortamı bu dalı zorunlu kılıyor)
**Çalıştırma:** https://github.com/MuhaWin/Muhawin/actions/runs/40028913731 (PR #34 dalı). Ekran görüntüsü artefaktı bu ortamdan indirilemedi (Azure blob adresi ağ kuralına takıldı). Kök nedenler CI günlüğü ve kod okumasıyla bulundu.

## CI'daki hatalar
| # | Adım | Belirti |
|---|---|---|
| 1 | 5. senaryo, `test/e2e.js` `await w.click('#fkkClose')` | 30 sn zaman aşımı (iki denemede de). Hemen önceki "muavin yenileme arka planda başladı" geçiyor |
| 2 | 1. senaryo, Çek/Senet › Logo | "Logo fişleri … (0 fiş)", ardından `#cekTemizle` 30 sn zaman aşımı. Aynı belirti bu oturumda yerelde de bir kez görüldü (Görev 15 öncesi koşu: 430 hareket "hesap yok") |

## Kök nedenler
### 1. `#fkkClose`: bekleme penceresi düğmeyi örtüyor (test zamanlaması)
- **Akış:** `#fkkYenile` → `FKAYIT.muavinYenile()` → `Busy.show('Muavin Luca'dan indiriliyor…', …, {iptalAd:'Arka planda devam etsin'})`.
  - Bu tam ekran pencere, muavin indirilip kontrol yenilenince (`kayitSonrasi` → muavin bitince `sonra`) kendiliğinden kapanıyor.
- **Sorun:** Test 2,5 sn sabit bekleyip `#fkkClose`'a tıklıyordu.
  - Yerelde sahte Luca ile indirme bu sürede bitiyor, pencere kapanıyor.
  - CI'da (2 çekirdek, Python yan süreci + Playwright) indirme sürüyor, pencere tıklamayı yakalıyor ve Playwright 30 sn bekleyip düşüyor.
- Programda hata yok; pencere bilerek açılıyor ve kullanıcıya "Arka planda devam etsin" seçeneği sunuyor.

### 2. Logo "0 fiş": çek/senet hesap yüklemesinde yarış (program hatası)
- **Eski davranış:** `CEK.hesaplariYukle()`:
  - Önce `st.acc` / `st.leaf`'i boşaltıp önbellekleri (`st.hx`: hareket → hesaplar) temizliyordu.
  - Sonra mizanı **bekleyip** dolduruyordu.
- **Yarış:** Bekleme sırasında hesaplar boş haritayla hesaplanıp önbelleğe giriyordu. Bunu tetikleyenler:
  - Logo dosyası eklenmesi (`dosyaEkle` → `hatalar()` / `eksikler()`).
  - Ya da başka bir yükleme: İNKA kaydından 2,5 sn sonra başlayan `HESAP.kayitSonrasi` → `yenile(f)` → `CEK._yenile()`, firma değişimi (`_firmaDegisti`), testin `_yenile()`'si.
- **Sonuçlar:**
  - Önbellek dolduktan sonra temizlenmediği için çekler "hesap yok" kalıyor. Hareketlerin seçimi kalkıyor (`_eksik`) → **0 fiş**.
  - Eksik vade hesapları için otomatik "hesaplar açılsın mı?" penceresi açılıyor ve `#cekTemizle`'yi örtüyor → **zaman aşımı**.
  - Ayrıca geç biten eski bir yükleme (önceki firma) yeninin haritasına kendi hesaplarını yazabiliyordu.
- **Neden CI'da:** Yavaş makinede kayıt sonrası mizan / plan yenilemesi firma değişimi ve dosya eklemeyle üst üste biniyor.
- **Testin payı:** Firma değişimini bekleyen satır (`waitForFunction(… 'savor' …, 10 sn).catch(() => {})`) zaman aşımını **sessizce yutuyordu**; değişim gecikince test yanlış firmayla devam ediyordu.

## Düzeltmeler
| Dosya | Değişiklik |
|---|---|
| `renderer/index.html` (Çek/Senet) | `hesaplariYukle`: sıra numaralı. Mizan beklendikten sonra yeni `Map`/`Set` kurulup **bir kerede** yerine konuyor ve önbellek **ondan sonra** temizleniyor. Yerini yeniye bırakan eski yükleme sonucunu yazmıyor, en son yüklemenin bitmesini bekliyor (`yukSon`); onu bekleyen kod (dosya ekleme, firma değişimi) güncel hesaplarla devam ediyor |
| `renderer/index.html` (HESAP) | `window.__mwMesgul()`: kayıt sonrası mizan/plan yenilemesi bekliyor ya da sürüyor mu (yalnız test için okunur) |
| `test/e2e.js` (Logo) | Firma değişmeden önce kayıt sonrası yenilemenin bitmesi beklenir (`__mwMesgul`, 60 sn). Firma değişimi 30 sn beklenir ve **zaman aşımı artık yutulmaz** |
| `test/e2e.js` (5. senaryo) | `#fkkYenile`'den sonra bekleme penceresi açıksa kullanıcı gibi "Arka planda devam etsin"e basılır (`#mwBusyIptal`), pencere kapanınca `#fkkClose`. Test atlanmadı, denetimler aynı |

Testlerden hiçbiri atlanmadı ya da devre dışı bırakılmadı.

## Testler
| Test | Sonuç |
|---|---|
| `xvfb-run -a node test/e2e.js` (yerel, tek başına) | PR açıklamasında |
| Yük altında karşılaştırma (2 çekirdek + sürekli CPU yükü, eski ve yeni aynı anda) | **Sonuçsuz.** Eski kod 270/0 geçti (CI hataları yerelde yeniden üretilemedi). Yeni kod erken bir adımda (Fatura Kontrol çerçevesi 20 sn'de açılmadı) takıldı: iki e2e'nin aynı anda iki Python yan süreci açmasından gelen ortam etkisi, değişen kodla ilgisiz |
| CI doğrulaması | `surum.yml` test adımı bu dalda çalıştırılmalı (`workflow_dispatch`); Güncelleme oturumu / yöneticiyle koordine ediliyor |

## Riskler
- **Kanıt düzeyi:** CI ekran görüntüleri görülemediği için iki kök neden kod okumasıyla bulundu ("Olası" düzeyinde). Hata 1'in mekanizması kesin (pencere ve sabit bekleme). Hata 2'nin belirtileri (0 fiş + `#cekTemizle`) yarışla birebir uyuşuyor.
- **CI'da başka zamanlama sorunu:** Yük altında görülen "Fatura Kontrol çerçevesi 20 sn" beklemesi gibi başka sabit süreler CI'da da sınırda olabilir. CI tekrar kırılırsa aynı yaklaşım (durum temelli bekleme) uygulanmalı.
