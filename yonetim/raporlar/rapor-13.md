# Rapor 13 – Mobil yönetim paneli (MuhaWin/Muhawin-yonetim-)

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 23.10.2026
Dal: `claude/beautiful-bohr-c7x9ij` (oturum ortamının dalı). Taban: `main` 213e3dc.
`renderer/`, `main.js` ve `fk/`'e dokunulmadı.

## Durum tespiti (doğrulandı)
Pages deposu (`MuhaWin/Muhawin-yonetim-`, tek commit "Add files via upload") ile kaynak (`mobil-yonetim/`) karşılaştırıldı:

| Dosya | Sonuç |
|---|---|
| `index.html`, `manifest.webmanifest` | aynı |
| `uygulama.js` | yalnız Görev 10 adları farklı: Pages'te hâlâ "Hızlı Fiş Girişi" ve "Mikro Denetim" var |
| `ikon-192.png`, `ikon-512.png`, `apple-touch-icon.png` | bayt olarak farklı, **piksel olarak aynı** (boyutlar aynı; görüntü farkı yok). Kaynaktakiler daha küçük (sıkıştırılmış). |

Bu oturumdan Pages deposuna push **reddediliyor**: Claude GitHub uygulaması o depoda kurulu değil. Depo yalnız okuma için oturuma eklendi.

## Yapılanlar
1. **Tek kaynak + otomatik eşitleme:** `.github/workflows/mobil-yonetim.yml`
   - PR'da ve `main`'de `node test/mobil.js` çalışır (sahte Supabase).
   - `main`'e `mobil-yonetim/**` değişikliği gelince (ya da Run workflow ile) içerik `MuhaWin/Muhawin-yonetim-` deposuna kopyalanıp commit edilir. Elle eklenmiş `CNAME` ve `.nojekyll` korunur.
   - `YONETIM_TOKEN` sırrı yoksa test yapılır, sonra açık bir hata iletisiyle durulur; Pages deposuna dokunulmaz.
   - Eşitleme adımı yerelde, deponun kopyası üzerinde denendi. Giden değişiklik: `uygulama.js` (adlar + D5) ve 3 ikon (aynı görüntü).
2. **İlk eşitleme (Görev 10 adları):** İş akışı, sır eklendikten sonraki ilk çalıştırmada adları Pages'e taşır. Beklemek istenmezse **Actions → MuhaWin yönetim paneli → Run workflow**.
3. **Güvenlik (rapor-02 D5):** Yönetici yenileme belirteci artık `localStorage`'da değil, **`sessionStorage`'da** (yalnız o sekme / o uygulama oturumu).
   - Eski sürümün `localStorage` kaydı ilk açılışta bir kez `sessionStorage`'a alınıp silinir; kullanıcı güncellemede oturumdan atılmaz.
   - Aynı sekmede yenileme oturumu korur, yalnız yönetim şifresi sorulur (önceki gibi). Yeni sekmede ya da uygulama kapanıp açılınca e-posta + şifre yeniden istenir.
   - 10 dakikalık arka plan kilidi ve yönetim şifresi aynen duruyor.

## Testler
- `node test/mobil.js`: **45/45** (önceden 42). Yeni kontroller:
  - oturum `localStorage`'da değil, `sessionStorage`'da;
  - yeni sekmede yeniden giriş isteniyor;
  - eski kayıt taşınıp `localStorage`'dan siliniyor.
- Gerçek Supabase'e istek yok (testin sahte sunucusu).
- `mobil-yonetim.yml`: YAML geçerli; `playwright@1.48.2` npm'de var. Gerçek çalıştırma `main`'e birleşince olur.

## Kullanıcının yapacakları (bir kez)
1. **Token:** github.com → sağ üst profil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - *Resource owner:* **MuhaWin**. Kuruluş, fine-grained token'lara onay istiyorsa kuruluş ayarlarından onaylayın.
   - *Repository access:* **Only select repositories → Muhawin-yonetim-**
   - *Permissions → Repository → Contents:* **Read and write** (başka izin gerekmez)
   - *Expiration:* örneğin 1 yıl. Süre dolunca aynı adımlarla yenilenir.
   - **Generate** deyin ve token'ı kopyalayın. Sohbete ya da bir dosyaya yazmayın.
2. **Sır:** `MuhaWin/Muhawin` → **Settings → Secrets and variables → Actions → New repository secret** → ad `YONETIM_TOKEN`, değer kopyaladığınız token.
3. **İlk eşitleme:** **Actions → MuhaWin yönetim paneli → Run workflow**. Telefondaki panel birkaç dakika içinde yeni adları gösterir; gerekirse uygulamayı kapatıp açın.
   - Alternatif: Claude GitHub uygulaması o depoya kurulursa (https://github.com/apps/claude/installations/select_target) Claude doğrudan da push edebilir. İş akışı varken gerek yok.

## Kullanıcı kararı bekleyen
- **"Beni hatırla" (iPhone):** iPhone'da ana ekrana eklenmiş panel, uygulama tamamen kapatılınca (yukarı kaydırıp kapatma) `sessionStorage`'ı siler; yani her yeniden açılışta e-posta + şifre + yönetim şifresi istenir. Kısa süreli arka planda kalma bundan etkilenmez.
  - Öneri: **böyle kalsın.** Bu panel üye, lisans ve kod üretimini yönetiyor.
  - İstenirse bir "Bu telefonda beni hatırla" kutusu eklenir: yalnız işaretlenince `localStorage`'a yazar; yönetim şifresi yine her açılışta sorulur.
- **İleri adım (öneri):** Panel, Cloudflare Pages'ten `yonetim.muhawin.com.tr` olarak sunulabilir.
  - `web/KURULUM.md` → "Alt adresler": `mobil-yonetim/` için ikinci bir Pages projesi.
  - Bu yapılırsa eski GitHub Pages adresi (`muhawin.github.io/Muhawin-yonetim-/`) yeni adrese yönlendiren tek bir sayfaya döner ve eşitleme iş akışı gereksizleşir.
  - **Kurulu PWA'lar için geçiş:** Ana ekrandaki eski simge eski adresi açar ve yönlendirme sayfası yeni adrese geçirir. iPhone, yönlendirilen PWA'yı tarayıcı sekmesinde açabilir. Bu yüzden kullanıcı bir kez yeni adresi Safari'de açıp **Paylaş → Ana Ekrana Ekle** demeli ve eski simgeyi silmeli.
  - Oturum yeni adreste yeniden açılır (depolama adrese bağlıdır).
  - Bu geçiş, ana site yayına alındıktan sonra yapılmalı.

## Devir notu
- Panelde değişiklik: `mobil-yonetim/` düzenlenir → `node test/mobil.js` → PR → `main` → iş akışı Pages'e taşır. Pages deposuna elle yükleme yapılmaz.
- Token süresi dolarsa iş akışı `git push` adımında yetki hatası verir; token yenilenip sır güncellenir.
