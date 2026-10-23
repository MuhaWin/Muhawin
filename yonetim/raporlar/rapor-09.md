# Rapor 09 – Web: Denetim tarayıcıda + site girişi (W1 + W2)

Uygulayan: Web Asistanı (`session_01GmVYe6iE3V7psTH1xXFUiq`) · 23.10.2026
Dal: `claude/beautiful-bohr-c7x9ij` (oturum ortamının zorunlu kıldığı dal). Taban: `main` 47cdc97.
`fk/`, `renderer/`, `main.js`, `luca.js` ve `package.json` değişmedi.

## Ne yapıldı
| Kart maddesi | Durum | Dosyalar |
|---|---|---|
| W2 – giriş ve lisans | Tamam | `web/site/giris.html`, `web/site/ortak/oturum.js`, `web/site/ortak/ayar.js` |
| W1 – Denetim tarayıcıda | Tamam (Görev 08'i beklemeden çalışıyor, aşağıya bakın) | `web/denetim/` (`kopru.js`, `calisan.js`, `kopru.py`), `tools/site_uret.js --denetim` |
| Yayın hazırlığı | Tamam; yayın yapılmadı | `.github/workflows/site.yml`, `web/site/_headers`, `web/KURULUM.md`, `OKUBENI.txt` (5. madde) |
| Alan adı / Cloudflare rehberliği | Adımlar yazıldı; kullanıcı alan adını alınca sohbette birlikte yapılacak | `web/KURULUM.md` |

### W2 – giriş ve lisans
- Supabase e-posta/şifre girişi, oturum yenileme, çıkış, şifre yenileme (e-posta kodu; programdaki akışla aynı).
- Erişim belirteci yalnız bellekte. Yenileme belirteci sekmeye özgü `sessionStorage`'da (sekme kapanınca silinir); `localStorage`'a oturum yazılmaz (rapor-02 D5).
- Lisans `rpc/app_status` ile, **`p_device` boş** gönderilerek alınır: web girişi bilgisayar sınırına sayılmaz. Kurallar programdaki `cloud.js` (`moduleOf` / `birlesik`, TEK LİSANS) ile aynı. Denetim, ofisine `ozel` → `mikro` tanımlı ve lisansı geçerli hesaplara açılır.
- Yalnız `anon` anahtar kullanılıyor (`ortak/ayar.js`; programdakiyle aynı ve zaten herkese açık). `service_role` yok.
- Girişten sonra dönülecek adres yalnız sitenin kendi sayfası olabilir; başka siteye yönlendirme yapılamaz.

### W1 – Denetim tarayıcıda
- **Tek kaynak:** Sayfa (`denetim.html`, `beyanname.html`) ve Python paketi derleme sırasında `fk/fatura_kontrol`'den alınır. Siteye özgü kopya yok; programda yapılan düzeltme siteye de gelir.
- **Köprü (`kopru.js`):** Sayfanın `/api/...` çağrılarını (fetch, `<a href>`, `window.open`, beyannamedeki `location.href`) Web Worker'a yönlendirir. Ağa istek çıkmaz.
- **Python tarafı (`kopru.py`):**
  - `app.py`'deki uç noktalar küçük bir FastAPI taklidiyle **doğrudan çağrılır**; denetim kodu yeniden yazılmadı.
  - Luca'ya bağlanan uç noktalar 404 döner: toplu kontrol, Luca'dan fatura, ayarlar, bildirim, verileri sil.
- **Veri:** `/veri` IndexedDB'de (IDBFS) tutulur: bu tarayıcı, bu bilgisayar. Sayfa yenilenince önceki denetimler duruyor.
- **Firma listesi:** Programda MuhaWin veriyor. Sitede köprü bu listeyi önceki denetimlerden ve "Yeni firma adı → Ekle" ile kurup sayfaya programdaki mesaj biçimiyle verir; sayfa kodu değişmedi.
- **Güvenli görüntüleme:** Fiş, çıktı raporu ve fatura ayrı pencerede, `sandbox="allow-scripts allow-modals"` çerçevesinde açılır. Faturayla gelen şablon sitenin oturumuna erişemez; testte denendi.
- **CSP (`_headers`):** `/denetim/*` ve `/giris.html` yalnız siteye ve lisans sunucusuna bağlanabilir. Kötü niyetli bir betik çalışsa bile belgeyi başka bir adrese gönderemez.
- **Boyut:** Pyodide 14 MB (gzip ≈ 5 MB), Python paketi + wheel'ler 0,5 MB. İlk açılışta indirilir, sonra önbellekten gelir. Depoya girmez; derlemede (`npm ci` + `pip download`) eklenir.

### Görev 08 ile ilişki (kararınızı bekleyen nokta)
- Köprü, `app.py`'nin kendisini içe aktarıyor. `app.py` en üstte `sqlite3` ve `toplu_api` → `playwright` zincirini içe aktardığı için `kopru.py` bunların yerine boş modüller koyuyor.
- Görev 08 (`rapor_kayit.py` ayrımı) bu yaklaşımda **zorunlu değil**: denetim bugünkü `main` ile çalışıyor (testler aşağıda).
- Kartın "Görev 08 gelince taslakları kaldır" maddesi bu yaklaşımda tam uygulanamaz. FastAPI taklidi kalıcıdır, çünkü uç noktaları tekrar yazmamayı sağlıyor.
- Öneri: Görev 08 yine de yapılsın (masaüstü/test için temiz). Ayrıca `app.py`'deki `toplu_api` içe aktarımı tembel hâle getirilirse `playwright` taklidi de kalkar.

## Testler
| Test | Sonuç |
|---|---|
| `node --test test/site_uret.test.js` (sürüm notu, zip yazıcı, sayfa uyarlama) | 5/5 |
| `node --test web/denetim/kopru.test.mjs` (derlenmiş paketle Pyodide; sahte veri) | 2/2: denetim (KDV 0 · Matrah 1 · Cari 1), liste, yeniden açma, Excel (xlsx baytları), çıktı raporu, fiş yazdırma, fatura görüntüsü, yerel belgelerle yeniden denetim; eksik dosya 422, Luca uç noktaları 404 |
| `python3 web/denetim/site_e2e.py` (Chromium, `_headers`/CSP uygulanmış, sahte Supabase) | 20/20: oturumsuz → giriş; yanlış şifre; oturum yalnız sessionStorage'da; firma ekle → denetim → özet ve sorunlu kayıtlar; Excel iner; çıktı raporu kum havuzlu çerçevede ve oturuma erişemiyor; KDV beyannamesi sayfası; yenileyince denetim duruyor; çıkış; ofisine tanımlı olmayan hesap giremez; CSP ihlali yok; site ve Supabase dışında istek yok; Supabase'e yalnız giriş/lisans (en büyük gövde 67 bayt) |
| CI paket seti (temiz venv: pytest, openpyxl, lxml, xlrd, playwright 1.64.1) ile örnek üretimi ve e2e | geçti |
| pytest (`fk/`) | `fk/` değişmediği için çalıştırılmadı; `main` ile aynı |

Gerçek Supabase'e istek atılmadı. Gerçek müşteri verisi kullanılmadı (girdiler `fk/tests` üreticilerinden).

Ekran: `rapor-09/site-denetim-sahte-veri.png`. Başlıkta "Mikro Denetim" yazıyor; ad ve program seçimi `fk/` işi (aşağıda).

## Kullanıcı / yönetici kararı bekleyenler
1. **Alan adı** (`muhawin.com.tr`, isteğe bağlı `muhawin.tr`), Cloudflare hesabı, GitHub sırları (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) ve `SITE_YAYIN=1`. İlk yayın kullanıcının "Run workflow" onayıyla yapılır.
2. **Denetim'in genişletilmesi** (kullanıcı kararı): `denetim.html`'de program seçimi ve adın "Denetim" olması; diğer programların muavin ve red/iptal okuyucuları. Bunlar `fk/` işi (Yazılımcı). Site yeni okuyucuları derlemeyle kendiliğinden alır.
3. Görev 08 kapsamı: yukarıdaki öneri (`toplu_api` içe aktarımını tembel yapmak).
4. Bu PR'ın birleşmesiyle `site.yml` her `main` push'unda derleme ve test yapar. Yayın, `SITE_YAYIN` tanımlanana kadar kapalı.

## Bilinen sınırlar
- Fatura görüntüsü tarayıcıda "sade görünüm"le açılıyor: GİB XSLT şablonu `lxml` istiyor ve Pyodide'de yok. İleride tarayıcının kendi XSLTProcessor'ıyla, kum havuzlu çerçevede yapılabilir (S).
- Lisans denetimi tarayıcıda atlatılabilir. Belge sızıntısı olmadığı için kartta kabul edildi (analiz §2).
- Veriler tarayıcıya bağlı: başka bir bilgisayarda ya da tarayıcı verileri silinince önceki denetimler görünmez. İsteğe bağlı "bilgisayardaki klasörü kullan" (File System Access API) yapılmadı; gerekirse sonraki iş.

## Commit'ler
Bu PR'daki commit listesi PR sayfasında.

## Devir notu
- Derleme: `(cd web/denetim && npm ci && pip download --no-deps -r wheels.txt -d wheels) && node tools/site_uret.js --denetim`
- Yeni bir uç nokta ya da program okuyucusu `fk/`'ye eklendiğinde sitede ek iş gerekmez.
- Yalnız `denetim.html` / `beyanname.html`'in genel yapısı değişirse (ilk satır içi `<script>`, `/tema.css` bağlantıları) `sayfaUyarla` bozulmayı açık bir hata ile bildirir ve test yakalar.
