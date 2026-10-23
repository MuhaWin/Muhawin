# Güncelleyici – Kalıcı Görev Kartı

**Rol:** Derleme ve sürüm yayınlama. Kalıcı işçidir; yönetici her derleme için bu kartın sonundaki "İş kayıtları" tablosuna yeni bir satır ekler.
**Oturum adı:** Güncelleyici · **Depo:** `MuhaWin/Muhawin` (ayrıca yayın için `muhawin/muhawin-surumler`) · **Mesaj sınırı:** her iş için 20

## Başlarken
1. `yonetim/YONETICI.md` dosyasındaki "İşçi oturum kuralları" bölümünü uygula. Bu rolde derleme kullanıcının açık isteğiyle yapılır; yönetici bu tabloya iş yazdığında istek var sayılır.
2. Bu kartı ve `yonetim/belgeler/ana-depo-ozet.md` §4'ü (derleme adımları) oku.
3. Tablodaki **Açık** durumdaki ilk işi al. Açık iş yoksa kullanıcıya söyle ve dur.

## Derleme adımları
1. `main` dalından `surum-<sürüm>` dalını aç (ör. `surum-2.9.13`).
2. Testleri çalıştır. Biri düşerse derleme yapma; yöneticiye raporla.
   - `xvfb-run -a node test/e2e.js`
   - `node test/mobil.js`
   - `cd fk && python3 -m pytest -q` (~8 dk; `nohup` ile)
   - `NODE_PATH=/opt/npm-tools/node_modules node test/luca/*.js` (varsa)
3. `package.json` → `version` alanını işteki sürüme getir. OKUBENI.txt'ye "<sürüm> YENİLİKLER" bölümünü yaz (başlık ve KURULUM satırındaki sürüm dahil). Yenilikler, son sürümden bu yana `main`'e giren PR'lardan derlenir.
4. `python3 tools/python_win.py` (requirements değiştiyse ya da `build/` içinde gömülü Python yoksa), sonra `npx electron-builder --win nsis --x64 --publish never` (~6 dk).
5. Derlemeden sonra `dist/` içinde şu üç dosya aynı derlemeden olmalı: `MuhaWin-Kurulum-<sürüm>.exe`, `.exe.blockmap`, `latest.yml`. `latest.yml` içindeki `version` ve `sha512` exe ile tutarlı olmalı.
6. `package.json` → `build.publish` ayarının `muhawin/muhawin-surumler` olduğunu kontrol et. Kurulu programın güncellemeyi buradan alması bu ayara bağlıdır.

## Teslim
İşteki "Teslim" sütununa göre:
- **Deneme:** Kullanıcıya SendUserFile ile gönderilir, GitHub'a yayınlanmaz. Exe tek dosya olarak gönderilemiyorsa ana-depo-ozet §4'teki parçalama (`split` + BIRLESTIR.bat) uygulanır.
- **Yayın:** GitHub'da `muhawin/muhawin-surumler` deposunda `v<sürüm>` etiketli, "release" türünde (taslak ya da ön sürüm değil) bir sürüm açılır ve üç dosya yüklenir.
  - Yükleme bu oturumdan yapılabiliyorsa (`add_repo` ile depoya push yetkisi + `gh release create`), yap.
  - Yapılamıyorsa üç dosyayı SendUserFile ile kullanıcıya gönder ve adımları yaz: `github.com/muhawin/muhawin-surumler/releases/new` → Tag `v<sürüm>` → üç dosyayı sürükle → "Publish release".
  - Yayından sonra `https://github.com/muhawin/muhawin-surumler/releases/latest` adresinin yeni sürümü gösterdiğini doğrula.

Her iki teslimde de:
- `surum-<sürüm>` dalına sürüm commit'ini (package.json + OKUBENI) push et ve `Sürüm <sürüm>` başlıklı PR aç. Yönetici birleştirir. Etiketi (`v<sürüm>`) PR birleştikten sonra yönetici ya da kullanıcı koyar.
- Raporu `yonetim/raporlar/rapor-guncelleyici.md` dosyasına ekle (en yeni iş üstte): sürüm, taban commit, test sayıları, dosya boyutları, `latest.yml` sha512 (ilk 12 karakter), teslim şekli, sorunlar.

## Kurallar
- Kaynak kodu değiştirme. Bu rolün değiştirebileceği dosyalar yalnız `package.json` (`version`), `OKUBENI.txt` ve kendi rapor dosyasıdır. Derleme bir kod hatası yüzünden olmuyorsa raporla; düzeltmeyi yönetici ayrı görev olarak açar.
- Kod imzalama sertifikası yok; exe imzasız. Windows SmartScreen uyarısı beklenen bir durumdur, raporda belirtilmesi yeterli.
- Gizli bilgi, token ve müşteri verisi commit edilmez ve sürüme konmaz.

## İş kayıtları
| İş | Sürüm | Taban | Teslim | Durum |
|---|---|---|---|---|
| G-01 | 2.9.13 | `main` (Görev 01 ve 03 öncesi) | **Deneme** (kullanıcı programın son halini denemek istiyor) | Açık |
