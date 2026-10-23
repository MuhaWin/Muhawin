# Görev 03 – Açılışta Güncelleme Sorusu

**Durum:** Açık · **Taban:** `main` · **Dal:** `gorev-03-guncelleme-sorusu` · **Mesaj sınırı:** 20
**Uygulayan oturum:** Ana Depo

## Başlarken
1. `yonetim/YONETICI.md` dosyasındaki "İşçi oturum kuralları" bölümünü uygula.
2. `main.js` içindeki `setupUpdater` bölümünü (otomatik güncelleme) ve `preload.js` → `update` köprüsünü oku.
3. `main` dalından `gorev-03-guncelleme-sorusu` dalını aç.

## Bugünkü davranış
- Program açıldıktan 10 sn sonra ve 4 saatte bir `checkForUpdates` çağrılır.
- `autoDownload = true`: Yeni sürüm kullanıcıya sorulmadan indirilir. İndirme bitince "Yeniden Başlat ve Güncelle" düğmesi çıkar; program kapanınca da kurulur.

## İstenen davranış (kullanıcı kararı, 23.10.2026)
1. Program açılınca güncelleme denetlenir (bugünkü gibi; yalnız kurulu programda).
2. Yeni sürüm varsa ekranda bir soru çıkar:
   - Başlık: "Yeni sürüm var"
   - Metin: "MuhaWin <yeni sürüm> yayınlandı (kurulu: <mevcut sürüm>). Şimdi indirip kurmak ister misiniz?"
   - Düğmeler: **"Şimdi kur"** (varsayılan) · **"Sonra"**
3. **Şimdi kur:** Güncelleme indirilir. İlerleme mevcut `update-event` akışıyla gösterilir (`downloading`, yüzde). İndirme bitince program kapanıp güncellemeyi kurar ve yeniden açılır (`quitAndInstall`). Çıkış onayı (`cikisOnay`) bu yolda sorulmaz.
4. **Sonra:** Hiçbir şey indirilmez. O oturumda aynı sürüm için soru tekrar sorulmaz (4 saatlik denetimde de sorulmaz). Program bir sonraki açılışta yine sorar.
5. **"Güncellemeleri Denetle" düğmesi** (ana sayfa ve Ayarlar): Kullanıcı kendisi bastığında yeni sürüm varsa aynı soru gösterilir ("Sonra" denmiş olsa bile).
6. İndirme ya da kurulum hatasında açık bir hata mesajı gösterilir; program çalışmaya devam eder.

## Teknik yön
- `autoDownload = false` yapılır; indirme yalnız onaydan sonra `downloadUpdate()` ile başlar. `autoInstallOnAppQuit = true` kalabilir (yalnız onaylanıp indirilmiş güncellemeyi kurar).
- Soru Electron'un yerel penceresiyle (`dialog.showMessageBox`, ana pencereye bağlı) gösterilir. Böylece `renderer/index.html` değişmez ve Görev 01 ile çakışma olmaz.
- Karar mantığını (ne zaman sorulur, "Sonra" hatırlanır mı, elle denetim) ayrı bir modüle al, ör. `guncelleme.js`. Modül `updater` ve `dialog` nesnelerini parametre olarak alsın; böylece birim testi sahte nesnelerle yazılabilir. `main.js`'deki değişiklik bu modülü bağlamakla sınırlı kalsın.
- `MUHAWIN_NO_UPDATE` ve `app.isPackaged` koşulları aynı kalır.

## Dokunulacak dosyalar
- `main.js` (yalnız `setupUpdater` ve `update-*` IPC'leri)
- Yeni: `guncelleme.js`, `test/guncelleme.js`
- `package.json`: `build.files` listesine `guncelleme.js` **eklenmeli**. Liste dosyaları tek tek sayıyor; eklenmezse kurulu program açılışta çöker. Kabul için zorunlu.
- Dokunulmayacak: `renderer/index.html`, `luca.js`, `fk/`

**Sıra notu:** Görev 01 `renderer/index.html` dosyasını değiştiriyor. Bu görev o dosyaya dokunmadığı için paralel yürüyebilir. Görev 01 `main.js`'yi de değiştirirse, önce birleşen PR'dan sonra diğeri `main` üzerine rebase edilir.

## Kabul ölçütleri
- `node test/guncelleme.js`: en az şu durumlar sınanır: yeni sürüm yok → soru yok; yeni sürüm var + "Şimdi kur" → `downloadUpdate` ve indirme bitince `quitAndInstall`; "Sonra" → indirme yok, aynı oturumda ikinci denetimde soru yok; elle denetim → "Sonra" sonrası da soru var; indirme hatası → hata mesajı, çökme yok.
- `xvfb-run -a node test/e2e.js` (250) ve `node test/mobil.js` (42) geçer.
- Elle deneme gerçek bir GitHub sürümüyle yapılamaz; raporda belirt. Kurulu programda deneme, Güncelleme oturumunun ilk yayınından sonra kullanıcıyla yapılacak.
- Commit'ler Türkçe ve adım adım olmalı. **Derleme yapılmaz.**

## Teslim
Dalı push et ve `Görev 03: Açılışta güncelleme sorusu` başlıklı PR'ı aç. Aynı PR'da `yonetim/raporlar/rapor-03.md` dosyasını yaz: istek durumu, commit listesi, değişen dosyalar, test sayıları, riskler, devir notu.
